"use server";

import { revalidatePath } from "next/cache";
import { promoteFromWaitlist } from "@/lib/registrations/waitlist";
import { expireSubstitutions } from "@/lib/registrations/team-changes";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { joinPersonName } from "@/lib/validations/person-name";
import { isPayMongoConfigured } from "@/lib/env/server";
import { startRegistrationQrphPayment } from "@/lib/payments/start-paymongo-qrph";
import { splitPaymentAmount } from "@/lib/wallet/fees";
import { loadOrganizerWalletPolicy } from "@/lib/wallet/organizer-fee-profile";
import { notifyRegistrantAfterRegistration } from "@/lib/registrations/registrant-notify";
import { notifyPartnerAfterRegistration } from "@/lib/registrations/partner-notify";
import { applyBracketWithdrawalForRegistration } from "@/lib/draw/withdraw-entry";
import { notifyPlayersOrganizerRemovedEntry } from "@/lib/registrations/organizer-removal-notify";
import { reverseOrganizerWalletOnRemoval } from "@/lib/wallet/reverse-organizer-on-removal";

type Result = { ok?: boolean; error?: string };

const ACTIVE = ["confirmed", "awaiting_payment", "pending", "awaiting_partner"];

async function loadRegistration(registrationId: string) {
  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registrations")
    .select(
      "id, tournament_id, division_id, registered_by, status, payment_status, entry_source, tournament_divisions(name, entry_fee_cents), tournaments(name, slug, owner_id, entry_fee_cents)"
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return null;
  const division = (Array.isArray(reg.tournament_divisions) ? reg.tournament_divisions[0] : reg.tournament_divisions) as
    | { name: string; entry_fee_cents: number | null }
    | null;
  const tournament = (Array.isArray(reg.tournaments) ? reg.tournaments[0] : reg.tournaments) as {
    name: string;
    slug: string;
    owner_id: string;
    entry_fee_cents: number;
  };
  return { reg, division, tournament, feeCents: division?.entry_fee_cents ?? tournament.entry_fee_cents };
}

function revalidateEvent(tournamentId: string, slug?: string) {
  revalidatePath(`/organizer/tournaments/${tournamentId}/registrations`);
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  revalidatePath(`/organizer/tournaments/${tournamentId}/draw`);
  if (slug) revalidatePath(`/tournaments/${slug}`);
}

/** Turns "pay at the venue" on or off for a tournament. */
export async function setWalkInPaymentAction(tournamentId: string, allow: boolean): Promise<Result> {
  await requireOrganizerForTournament(tournamentId);
  const { data: t, error } = await createAdminClient()
    .from("tournaments")
    .update({ allow_walk_in_payment: allow })
    .eq("id", tournamentId)
    .select("slug")
    .single();
  if (error) return { error: error.message };
  revalidateEvent(tournamentId, t?.slug);
  return { ok: true };
}

/**
 * Organizer took cash at the desk. Confirms the entry and charges the platform
 * fee to the organizer's wallet (cash never passes through the platform).
 */
export async function recordCashPaymentAction(registrationId: string): Promise<Result> {
  try {
    const found = await loadRegistration(registrationId);
    if (!found) return { error: "Entry not found" };
    const { reg, tournament, feeCents } = found;
    const user = await requireOrganizerForTournament(reg.tournament_id);
    if (reg.payment_status === "paid") return { error: "This entry is already paid." };
    if (reg.status === "cancelled") return { error: "This entry was cancelled." };
    if (reg.status === "waitlisted") return { error: "This entry is on the waitlist — collect payment once it's moved into a slot." };

    const admin = createAdminClient();
    // any abandoned online/QR checkout for this entry is superseded by the cash
    await admin.from("payments").update({ status: "cancelled" }).eq("registration_id", registrationId).eq("status", "pending");

    const now = new Date().toISOString();
    const { data: payment, error } = await admin
      .from("payments")
      .insert({
        registration_id: registrationId,
        user_id: reg.entry_source === "desk" ? null : reg.registered_by,
        amount_cents: feeCents,
        currency: "PHP",
        status: "paid",
        paid_at: now,
        method: "cash",
        recorded_by: user.id,
        idempotency_key: `cash-${registrationId}`,
      })
      .select("id")
      .single();
    if (error || !payment) {
      return { error: error?.code === "23505" ? "Cash was already recorded for this entry." : (error?.message ?? "Couldn't record payment") };
    }

    await admin.from("registrations").update({ status: "confirmed", payment_status: "paid" }).eq("id", registrationId);

    const walletPolicy = await loadOrganizerWalletPolicy(admin, tournament.owner_id);
    const { platformFeeCents } = splitPaymentAmount(feeCents, walletPolicy.feePercent);
    if (platformFeeCents > 0) {
      const { error: feeError } = await admin.rpc("charge_cash_platform_fee", {
        p_user_id: tournament.owner_id,
        p_payment_id: payment.id,
        p_registration_id: registrationId,
        p_tournament_id: reg.tournament_id,
        p_platform_fee_cents: platformFeeCents,
        p_gross_cents: feeCents,
        p_description: `Platform fee (cash): ${tournament.name}`,
      });
      if (feeError) console.error("charge_cash_platform_fee failed:", feeError.message);
    }

    revalidateEvent(reg.tournament_id, tournament.slug);
    await notifyRegistrantAfterRegistration(registrationId, { kind: "payment_confirmed" });
    await notifyPartnerAfterRegistration(registrationId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't record payment" };
  }
}

/** Creates a PayMongo QR Ph session for this entry (scannable bank / Maya apps). */
export async function createDeskQrAction(
  registrationId: string
): Promise<Result & { qrImageUrl?: string; checkoutUrl?: string; amountCents?: number; expiresAt?: string }> {
  try {
    if (!isPayMongoConfigured()) return { error: "QR payments need PayMongo set up. Take cash for now." };
    const found = await loadRegistration(registrationId);
    if (!found) return { error: "Entry not found" };
    const { reg, division, tournament, feeCents } = found;
    const user = await requireOrganizerForTournament(reg.tournament_id);
    if (reg.payment_status === "paid") return { error: "This entry is already paid." };
    if (reg.status === "waitlisted") return { error: "This entry is on the waitlist — collect payment once it's moved into a slot." };
    if (feeCents <= 0) return { error: "This category is free — nothing to collect." };

    const payment = await startRegistrationQrphPayment({
      registrationId,
      userId: reg.entry_source === "desk" ? null : reg.registered_by,
      tournamentId: reg.tournament_id,
      tournamentName: tournament.name,
      tournamentSlug: tournament.slug,
      amountCents: feeCents,
      idempotencyKey: `qr-${registrationId}-${Date.now()}`,
      method: "qr",
      recordedBy: user.id,
      metadataExtra: { source: "desk_qr" },
      description: `${tournament.name} — ${division?.name ?? "Entry"}`,
    });
    return {
      ok: true,
      qrImageUrl: payment.qrImageUrl,
      checkoutUrl: payment.checkoutUrl,
      amountCents: feeCents,
      expiresAt: payment.expiresAt,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't create the QR checkout" };
  }
}

/** Polled by the QR dialog until the PayMongo webhook marks the entry paid. */
export async function getEntryPaymentStatusAction(registrationId: string): Promise<{ paid: boolean }> {
  const found = await loadRegistration(registrationId);
  if (!found) return { paid: false };
  await requireOrganizerForTournament(found.reg.tournament_id);
  return { paid: found.reg.payment_status === "paid" };
}

/**
 * Adds an entry at the desk (players may not have accounts). The organizer is
 * recorded as the registrant; player names are stored as guests.
 */
export async function addWalkInEntryAction(
  tournamentId: string,
  input: {
    divisionId: string;
    playerFirstName: string;
    playerLastName: string;
    partnerFirstName?: string;
    partnerLastName?: string;
  }
): Promise<Result & { registrationId?: string; feeCents?: number }> {
  try {
    const user = await requireOrganizerForTournament(tournamentId);
    const playerJoined = joinPersonName(input.playerFirstName, input.playerLastName);
    if (!playerJoined.ok) return { error: playerJoined.error };
    const playerName = playerJoined.value;

    const admin = createAdminClient();
    const [{ data: tournament }, { data: division }] = await Promise.all([
      admin.from("tournaments").select("slug, entry_fee_cents").eq("id", tournamentId).single(),
      admin
        .from("tournament_divisions")
        .select("id, name, format, capacity, entry_fee_cents, bracket_state")
        .eq("id", input.divisionId)
        .eq("tournament_id", tournamentId)
        .single(),
    ]);
    if (!tournament || !division) return { error: "Category not found" };
    if (division.bracket_state && division.bracket_state !== "not_started") {
      return { error: "This category's draw has started — reset the draw to add entries." };
    }
    const doubles = division.format === "doubles";
    let partnerName: string | null = null;
    if (doubles) {
      const partnerJoined = joinPersonName(input.partnerFirstName ?? "", input.partnerLastName ?? "");
      if (!partnerJoined.ok) return { error: partnerJoined.error };
      partnerName = partnerJoined.value;
    }

    const { count } = await admin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("division_id", division.id)
      .in("status", ACTIVE);
    if (division.capacity && (count ?? 0) >= division.capacity) {
      return { error: `${division.name} is full (${division.capacity}).` };
    }

    const feeCents = division.entry_fee_cents ?? tournament.entry_fee_cents;
    const { data: reg, error } = await admin
      .from("registrations")
      .insert({
        tournament_id: tournamentId,
        division_id: division.id,
        registered_by: user.id,
        status: feeCents > 0 ? "awaiting_payment" : "confirmed",
        payment_status: feeCents > 0 ? "pending" : "paid",
        entry_source: "desk",
      })
      .select("id")
      .single();
    if (error || !reg) return { error: error?.message ?? "Couldn't add the entry" };

    await admin.from("registration_players").insert([
      { registration_id: reg.id, guest_name: playerName, is_primary: true },
      ...(doubles && partnerName ? [{ registration_id: reg.id, guest_name: partnerName, is_primary: false }] : []),
    ]);

    revalidateEvent(tournamentId, tournament.slug);
    return { ok: true, registrationId: reg.id, feeCents };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't add the entry" };
  }
}

/** Frees an entry's slot (unpaid no-show or paid removal by the organizer). */
export async function cancelEntryAction(registrationId: string): Promise<Result> {
  const found = await loadRegistration(registrationId);
  if (!found) return { error: "Entry not found" };
  const user = await requireOrganizerForTournament(found.reg.tournament_id);
  if (found.reg.status === "cancelled") return { error: "This entry is already cancelled." };

  const admin = createAdminClient();
  const paidRemoval = found.reg.payment_status === "paid" && found.reg.entry_source !== "import";

  if (paidRemoval) {
    const { data: division } = await admin
      .from("tournament_divisions")
      .select("bracket_state")
      .eq("id", found.reg.division_id)
      .maybeSingle();

    if (division?.bracket_state && division.bracket_state !== "not_started") {
      const bracket = await applyBracketWithdrawalForRegistration(registrationId, { revalidate: false });
      if (bracket.error) return { error: bracket.error };
    }

    const wallet = await reverseOrganizerWalletOnRemoval(
      admin,
      registrationId,
      found.tournament.owner_id,
      found.reg.tournament_id,
      found.tournament.name
    );
    if (wallet.error) return { error: wallet.error };

    await admin.from("payments").update({ status: "refunded" }).eq("registration_id", registrationId).eq("status", "paid");
    await admin
      .from("registrations")
      .update({
        status: "cancelled",
        payment_status: "refunded",
        waitlist_position: null,
        needs_partner_since: null,
      })
      .eq("id", registrationId);

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const organizerName = profile?.full_name?.trim() || "The organizer";
    await notifyPlayersOrganizerRemovedEntry(registrationId, organizerName).catch(() => undefined);
  } else {
    await admin.from("payments").update({ status: "cancelled" }).eq("registration_id", registrationId).eq("status", "pending");
    await admin
      .from("registrations")
      .update({ status: "cancelled", waitlist_position: null, needs_partner_since: null })
      .eq("id", registrationId);
  }

  await expireSubstitutions(registrationId);
  await promoteFromWaitlist(found.reg.division_id);
  revalidateEvent(found.reg.tournament_id, found.tournament.slug);
  return { ok: true };
}
