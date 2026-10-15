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
    .select("id, slug, name, entry_fee_cents, status, registration_closes_at, max_capacity, allow_walk_in_payment")
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

  const { count: existingCount } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("division_id", division.id)
    .in("status", ["confirmed", "awaiting_payment", "pending", "awaiting_partner"]);

  if (division.capacity && (existingCount ?? 0) >= division.capacity) {
    return { error: "Division is full" };
  }

  const { data: dup } = await supabase
    .from("registrations")
    .select("id")
    .eq("division_id", division.id)
    .eq("registered_by", user.id)
    .not("status", "eq", "cancelled")
    .maybeSingle();
  if (dup) return { error: "You are already registered in this division" };

  const fee = division.entry_fee_cents ?? tournament.entry_fee_cents;
  let teamId: string | null = null;

  if (division.format === "doubles") {
    const { data: team } = await supabase
      .from("teams")
      .insert({ division_id: division.id })
      .select("id")
      .single();
    teamId = team?.id ?? null;
    if (teamId) {
      await supabase.from("team_members").insert({ team_id: teamId, user_id: user.id });
    }
  }

  const status = fee > 0 ? "awaiting_payment" : "confirmed";
  const payAtVenue = Boolean(params.payAtVenue && tournament.allow_walk_in_payment && fee > 0);
  const { data: registration, error } = await supabase
    .from("registrations")
    .insert({
      tournament_id: tournament.id,
      division_id: division.id,
      registered_by: user.id,
      team_id: teamId,
      status,
      payment_status: fee > 0 ? "pending" : "paid",
      entry_source: payAtVenue ? "pay_at_venue" : "online",
    })
    .select("id")
    .single();
  if (error || !registration) return { error: error?.message ?? "Registration failed" };

  await supabase.from("registration_players").insert({
    registration_id: registration.id,
    user_id: user.id,
    is_primary: true,
  });

  if (division.format === "doubles" && partnerName) {
    const token = partnerEmail ? randomBytes(24).toString("hex") : null;
    await supabase.from("registration_players").insert({
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
    if (partnerEmail) {
      await supabase
        .from("registrations")
        .update({ status: "awaiting_partner" })
        .eq("id", registration.id);
    }
  }

  const withWarnings = <T extends Record<string, unknown>>(payload: T) =>
    warnings.length ? { ...payload, warnings } : payload;

  if (payAtVenue) {
    revalidatePath(`/tournaments/${tournament.slug}`);
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
    const admin = createAdminClient();
    const idempotencyKey = `reg-${registration.id}-${Date.now()}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const checkout = await createCheckoutSession({
      amountCents: fee,
      description: `${tournament.name} registration`,
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
    return withWarnings({ registrationId: registration.id, checkoutUrl: checkout.checkoutUrl });
  }

  revalidatePath(`/tournaments/${tournament.slug}`);
  await notifyRegistrantAfterRegistration(registration.id);
  await notifyPartnerAfterRegistration(registration.id);
  return withWarnings({ registrationId: registration.id, confirmed: true });
}
