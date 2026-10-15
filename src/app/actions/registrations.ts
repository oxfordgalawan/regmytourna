"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPayMongoConfigured } from "@/lib/env/server";
import { createCheckoutSession } from "@/lib/services/paymongo/paymongo-service";
import { checkPartnerEmailConflict, normalizePartnerEmail } from "@/lib/registrations/partner-conflicts";
import { notifyPartnerAfterRegistration } from "@/lib/registrations/partner-notify";
import { notifyRegistrantAfterRegistration } from "@/lib/registrations/registrant-notify";
import { relationOne } from "@/lib/supabase/relations";
import { nextWaitlistPosition, takenInDivision } from "@/lib/registrations/waitlist";
import { cancelEntry, isCaptainOf, loadTeam } from "@/lib/registrations/team-changes";

export async function listMyRegistrationsForTournamentAction(tournamentSlug: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: tournament } = await admin
    .from("tournaments")
    .select("id")
    .eq("slug", tournamentSlug)
    .maybeSingle();
  if (!tournament) return { entries: [] as const };

  // entries I'm on (as captain or partner) — not ones I've left
  const { data: mine } = await admin.from("registration_players").select("registration_id").eq("user_id", user.id);
  const ids = (mine ?? []).map((r) => r.registration_id);
  if (!ids.length) return { entries: [] };
  const { data: regs } = await admin
    .from("registrations")
    .select("id, status, payment_status, division_id, tournament_divisions(name)")
    .eq("tournament_id", tournament.id)
    .in("id", ids)
    .neq("status", "cancelled");

  return {
    entries: (regs ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      paymentStatus: r.payment_status,
      divisionId: r.division_id,
      divisionName: (relationOne(r.tournament_divisions) as { name: string } | null)?.name ?? "Category",
    })),
  };
}

/** Cancel an unpaid entry you registered yourself (e.g. to pick another category). */
export async function cancelMyRegistrationAction(registrationId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registrations")
    .select("id, registered_by, payment_status, status, tournament_id, division_id, tournaments(slug)")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg || !(await isCaptainOf(reg.id, user.id))) return { error: "Entry not found." };
  if (reg.payment_status === "paid") {
    return { error: "This entry is already paid. Ask the organizer if you need to change categories." };
  }
  if (reg.status === "cancelled") return { ok: true as const };

  // same path as "Cancel our entry": frees the slot for the waitlist and tells the partner
  const team = await loadTeam(registrationId);
  if (!team) return { error: "Entry not found." };
  const res = await cancelEntry(team, user.id);
  if (!res.ok) return { error: res.error };

  const slug = (relationOne(reg.tournaments) as { slug: string } | null)?.slug;
  if (slug) revalidatePath(`/tournaments/${slug}`);
  revalidatePath(`/organizer/tournaments/${reg.tournament_id}/registrations`);
  revalidatePath("/entries");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function previewPartnerConflictAction(params: {
  tournamentSlug: string;
  divisionId: string;
  partnerEmail: string;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id")
    .eq("slug", params.tournamentSlug)
    .maybeSingle();
  if (!tournament) return { error: "Tournament not found" };

  const email = params.partnerEmail.trim();
  if (!email) return { blocked: undefined, warnings: [] as string[] };

  return checkPartnerEmailConflict({
    tournamentId: tournament.id,
    divisionId: params.divisionId,
    partnerEmail: email,
    excludeUserId: user.id,
  });
}

export async function createRegistrationAction(params: {
  tournamentSlug: string;
  divisionId: string;
  partnerName?: string;
  partnerEmail?: string;
  guestName?: string;
  /** player chose to pay in cash/QR at the venue (only if the tournament allows it) */
  payAtVenue?: boolean;
}) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, slug, name, entry_fee_cents, status, registration_closes_at, max_capacity, allow_walk_in_payment, waitlist_enabled")
    .eq("slug", params.tournamentSlug)
    .single();
  if (!tournament) return { error: "Tournament not found" };
  if (tournament.status !== "registration_open") {
    return { error: "Registration is not open" };
  }
  if (
    tournament.registration_closes_at &&
    new Date(tournament.registration_closes_at) < new Date()
  ) {
    return { error: "Registration deadline has passed" };
  }

  const { data: division } = await supabase
    .from("tournament_divisions")
    .select("id, format, capacity, entry_fee_cents, name")
    .eq("id", params.divisionId)
    .eq("tournament_id", tournament.id)
    .single();
  if (!division) return { error: "Division not found" };

  const partnerName = params.partnerName?.trim();
  const partnerEmailRaw = params.partnerEmail?.trim();
  const partnerEmail = partnerEmailRaw ? normalizePartnerEmail(partnerEmailRaw) : "";

  if (division.format === "doubles" && !partnerName) {
    return { error: "Partner's full name is required for doubles." };
  }
  if (partnerEmailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerEmailRaw)) {
    return { error: "Enter a valid partner email or leave it blank." };
  }
  if (partnerEmail && user.email && normalizePartnerEmail(user.email) === partnerEmail) {
    return { error: "Partner email can\u2019t be your own address. Leave it blank if your partner doesn\u2019t use email." };
  }

  let warnings: string[] = [];
  if (division.format === "doubles" && partnerEmail) {
    const conflict = await checkPartnerEmailConflict({
      tournamentId: tournament.id,
      divisionId: division.id,
      partnerEmail,
      excludeUserId: user.id,
    });
    if (conflict.blocked) return { error: conflict.blocked };
    warnings = conflict.warnings;
  }

  const admin = createAdminClient();

  // full category: join the waitlist (no payment) if the organizer allows it
  const full = Boolean(division.capacity && (await takenInDivision(division.id, admin)) >= division.capacity);
  if (full && !tournament.waitlist_enabled) {
    return { error: "This category is full." };
  }

  const { data: dup } = await admin
    .from("registrations")
    .select("id")
    .eq("division_id", division.id)
    .eq("registered_by", user.id)
    .not("status", "eq", "cancelled")
    .maybeSingle();
  if (dup) {
    const { data: existing } = await admin
      .from("registrations")
      .select("id, status, payment_status, entry_source")
      .eq("id", dup.id)
      .single();
    const hint =
      existing?.payment_status === "pending" && existing.status === "awaiting_payment"
        ? " You can complete payment from My entries, or cancel that entry to register again."
        : " See My entries for details.";
    return {
      error: `You are already registered in this category.${hint}`,
      existingRegistrationId: dup.id,
      existingStatus: existing?.status,
    };
  }

  const fee = division.entry_fee_cents ?? tournament.entry_fee_cents;
  let teamId: string | null = null;

  if (division.format === "doubles") {
    const { data: team, error: teamError } = await admin
      .from("teams")
      .insert({ division_id: division.id })
      .select("id")
      .single();
    if (teamError || !team) {
      return { error: teamError?.message ?? "Could not create team for this entry." };
    }
    teamId = team.id;
    const { error: memberError } = await admin.from("team_members").insert({ team_id: teamId, user_id: user.id });
    if (memberError) {
      await admin.from("teams").delete().eq("id", teamId);
      return { error: memberError.message };
    }
  }

  const status = full ? "waitlisted" : fee > 0 ? "awaiting_payment" : "confirmed";
  const payAtVenue = Boolean(!full && params.payAtVenue && tournament.allow_walk_in_payment && fee > 0);
  const waitlistPosition = full ? await nextWaitlistPosition(division.id, admin) : null;
  const { data: registration, error } = await admin
    .from("registrations")
    .insert({
      tournament_id: tournament.id,
      division_id: division.id,
      registered_by: user.id,
      team_id: teamId,
      status,
      payment_status: full || fee > 0 ? "pending" : "paid",
      entry_source: payAtVenue ? "pay_at_venue" : "online",
      waitlist_position: waitlistPosition,
    })
    .select("id")
    .single();
  if (error || !registration) return { error: error?.message ?? "Registration failed" };

  const { error: primaryPlayerError } = await admin.from("registration_players").insert({
    registration_id: registration.id,
    user_id: user.id,
    is_primary: true,
  });
  if (primaryPlayerError) {
    await admin.from("registrations").delete().eq("id", registration.id);
    return { error: primaryPlayerError.message };
  }

  if (division.format === "doubles" && partnerName) {
    const token = partnerEmail ? randomBytes(24).toString("hex") : null;
    const { error: partnerPlayerError } = await admin.from("registration_players").insert({
      registration_id: registration.id,
      guest_name: partnerName,
      ...(partnerEmail
        ? {
            guest_email: partnerEmail,
            partner_invite_status: "pending" as const,
            partner_invite_token: token,
          }
        : {}),
    });
    if (partnerPlayerError) {
      await admin.from("registrations").delete().eq("id", registration.id);
      return { error: partnerPlayerError.message };
    }
    // the entry follows its payment state; the partner's invite is tracked on their own row
  }

  const withWarnings = <T extends Record<string, unknown>>(payload: T) =>
    warnings.length ? { ...payload, warnings } : payload;

  await admin.from("profiles").update({ player_enabled: true }).eq("id", user.id);

  const revalidate = () => {
    revalidatePath(`/tournaments/${tournament.slug}`);
    revalidatePath(`/organizer/tournaments/${tournament.id}/registrations`);
    revalidatePath("/entries");
    revalidatePath("/dashboard");
  };

  // waitlisted: nothing to pay until a slot opens; the partner hears once they're in
  if (full) {
    revalidate();
    await notifyRegistrantAfterRegistration(registration.id, { kind: "waitlisted" });
    return withWarnings({ registrationId: registration.id, waitlisted: true, position: waitlistPosition });
  }

  if (payAtVenue) {
    revalidate();
    await notifyRegistrantAfterRegistration(registration.id);
    await notifyPartnerAfterRegistration(registration.id);
    return withWarnings({ registrationId: registration.id, payAtVenue: true });
  }

  if (fee > 0) {
    if (!isPayMongoConfigured()) {
      await notifyRegistrantAfterRegistration(registration.id);
      return withWarnings({
        registrationId: registration.id,
        paymentRequired: true,
        checkoutUrl: null,
        message: "Payment integration requires PayMongo configuration.",
      });
    }
    const idempotencyKey = `reg-${registration.id}-${Date.now()}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const checkout = await createCheckoutSession({
      amountCents: fee,
      description: `${tournament.name} registration (non-refundable)`,
      successUrl: `${appUrl}/tournaments/${tournament.slug}/register/success?registration=${registration.id}`,
      cancelUrl: `${appUrl}/tournaments/${tournament.slug}?cancelled=1`,
      metadata: {
        registration_id: registration.id,
        tournament_id: tournament.id,
        user_id: user.id,
      },
    });
    await admin.from("payments").insert({
      registration_id: registration.id,
      user_id: user.id,
      amount_cents: fee,
      currency: "PHP",
      status: "pending",
      paymongo_checkout_session_id: checkout.sessionId,
      idempotency_key: idempotencyKey,
    });
    await notifyRegistrantAfterRegistration(registration.id, {
      checkoutUrl: checkout.checkoutUrl,
    });
    revalidate();
    return withWarnings({ registrationId: registration.id, checkoutUrl: checkout.checkoutUrl });
  }

  revalidate();
  await notifyRegistrantAfterRegistration(registration.id);
  await notifyPartnerAfterRegistration(registration.id);
  return withWarnings({ registrationId: registration.id, confirmed: true });
}

/**
 * After being moved up from the waitlist, the player picks how to pay.
 * "Pay at the venue" keeps the slot held; they're confirmed once the desk records it.
 */
export async function choosePayAtVenueAction(registrationId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registrations")
    .select("id, registered_by, status, payment_status, tournament_id, tournaments(slug, allow_walk_in_payment)")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg || !(await isCaptainOf(reg.id, user.id))) return { error: "Only the team captain can choose how to pay." };
  const t = relationOne(reg.tournaments) as { slug: string; allow_walk_in_payment: boolean | null } | null;
  if (!t?.allow_walk_in_payment) return { error: "This tournament only takes online payment." };
  if (reg.payment_status === "paid") return { error: "This entry is already paid." };
  if (reg.status !== "awaiting_payment") return { error: "This entry isn't waiting for payment." };

  await admin.from("registrations").update({ entry_source: "pay_at_venue" }).eq("id", registrationId);
  await notifyPartnerAfterRegistration(registrationId).catch(() => undefined);
  revalidatePath(`/tournaments/${t.slug}`);
  revalidatePath(`/organizer/tournaments/${reg.tournament_id}/registrations`);
  revalidatePath("/entries");
  revalidatePath("/dashboard");
  return { ok: true as const };
}
