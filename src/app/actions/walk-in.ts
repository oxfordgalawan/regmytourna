"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl, isPayMongoConfigured } from "@/lib/env/server";
import { createCheckoutSession } from "@/lib/services/paymongo/paymongo-service";
import { splitPaymentAmount } from "@/lib/wallet/fees";

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

    const { platformFeeCents } = splitPaymentAmount(feeCents);
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
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't record payment" };
  }
}

/** Creates a PayMongo checkout for this entry, shown as a QR code for the player to scan. */
export async function createDeskQrAction(registrationId: string): Promise<Result & { checkoutUrl?: string; amountCents?: number }> {
  try {
    if (!isPayMongoConfigured()) return { error: "QR payments need PayMongo set up. Take cash for now." };
    const found = await loadRegistration(registrationId);
    if (!found) return { error: "Entry not found" };
    const { reg, division, tournament, feeCents } = found;
    const user = await requireOrganizerForTournament(reg.tournament_id);
    if (reg.payment_status === "paid") return { error: "This entry is already paid." };
    if (feeCents <= 0) return { error: "This category is free — nothing to collect." };

    const appUrl = getAppUrl();
    const checkout = await createCheckoutSession({
      amountCents: feeCents,
      description: `${tournament.name} — ${division?.name ?? "Entry"}`,
      successUrl: `${appUrl}/tournaments/${tournament.slug}/register/success?registration=${registrationId}`,
      cancelUrl: `${appUrl}/tournaments/${tournament.slug}`,
      metadata: { registration_id: registrationId, tournament_id: reg.tournament_id, source: "desk_qr" },
    });
    await createAdminClient().from("payments").insert({
      registration_id: registrationId,
      user_id: reg.entry_source === "desk" ? null : reg.registered_by,
      amount_cents: feeCents,
      currency: "PHP",
      status: "pending",
      method: "qr",
      recorded_by: user.id,
      paymongo_checkout_session_id: checkout.sessionId,
      idempotency_key: `qr-${registrationId}-${Date.now()}`,
    });
    return { ok: true, checkoutUrl: checkout.checkoutUrl, amountCents: feeCents };
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
  input: { divisionId: string; playerName: string; partnerName?: string }
): Promise<Result & { registrationId?: string; feeCents?: number }> {
  try {
    const user = await requireOrganizerForTournament(tournamentId);
    const playerName = input.playerName.trim();
    const partnerName = input.partnerName?.trim();
    if (playerName.length < 2) return { error: "Enter the player's name." };

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
    if (doubles && !partnerName) return { error: "Doubles needs a partner's name too." };

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

/** Frees the slot of an unpaid no-show. Paid entries need a refund instead. */
export async function cancelEntryAction(registrationId: string): Promise<Result> {
  const found = await loadRegistration(registrationId);
  if (!found) return { error: "Entry not found" };
  await requireOrganizerForTournament(found.reg.tournament_id);
  if (found.reg.payment_status === "paid") {
    return { error: "This entry is paid — refund it before cancelling." };
  }
  const admin = createAdminClient();
  await admin.from("payments").update({ status: "cancelled" }).eq("registration_id", registrationId).eq("status", "pending");
  await admin.from("registrations").update({ status: "cancelled" }).eq("id", registrationId);
  revalidateEvent(found.reg.tournament_id, found.tournament.slug);
  return { ok: true };
}
