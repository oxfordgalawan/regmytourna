import { createAdminClient } from "@/lib/supabase/admin";
import { promoteFromWaitlist } from "@/lib/registrations/waitlist";
import { SLOT_STATUSES } from "@/lib/registrations/waitlist";
import { notifyRegistrantAfterRegistration } from "@/lib/registrations/registrant-notify";

export const ONLINE_PAYMENT_HOLD_MS = 30 * 60_000;

type Admin = ReturnType<typeof createAdminClient>;

type HoldRow = {
  id: string;
  division_id: string;
  tournament_id: string;
  payment_hold_expires_at: string | null;
  payment_status: string;
  entry_source: string;
  status: string;
};

export function computePaymentHoldExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + ONLINE_PAYMENT_HOLD_MS).toISOString();
}

export function shouldSetPaymentHold(opts: {
  allowWalkInPayment: boolean;
  feeCents: number;
  entrySource: string;
  status: string;
}): boolean {
  if (opts.allowWalkInPayment) return false;
  if (opts.feeCents <= 0) return false;
  if (opts.entrySource !== "online") return false;
  return opts.status === "awaiting_payment" || opts.status === "pending";
}

export function isPaymentHoldActive(
  reg: {
    payment_hold_expires_at?: string | null;
    payment_status?: string;
    entry_source?: string;
  },
  now = new Date()
): boolean {
  if (reg.payment_status === "paid") return false;
  if (reg.entry_source !== "online") return false;
  if (!reg.payment_hold_expires_at) return false;
  const ends = new Date(reg.payment_hold_expires_at);
  return !Number.isNaN(ends.getTime()) && ends.getTime() > now.getTime();
}

/** True if this registration still occupies a public roster slot. */
export function holdsSlotNow(
  reg: {
    status: string;
    payment_hold_expires_at?: string | null;
    payment_status?: string;
    entry_source?: string;
  },
  now = new Date()
): boolean {
  if (reg.status === "waitlisted" || reg.status === "cancelled") return false;
  if (!(SLOT_STATUSES as readonly string[]).includes(reg.status)) return false;
  if (isPaymentHoldActive(reg, now)) return true;
  if (reg.payment_hold_expires_at && reg.payment_status === "pending" && reg.entry_source === "online") {
    const ends = new Date(reg.payment_hold_expires_at);
    if (!Number.isNaN(ends.getTime()) && ends.getTime() <= now.getTime()) return false;
  }
  return true;
}

async function releaseOneHold(reg: Pick<HoldRow, "id" | "division_id">, admin: Admin) {
  await admin.from("payments").update({ status: "cancelled" }).eq("registration_id", reg.id).eq("status", "pending");
  const { error } = await admin
    .from("registrations")
    .update({
      status: "cancelled",
      waitlist_position: null,
      needs_partner_since: null,
      payment_hold_expires_at: null,
    })
    .eq("id", reg.id);
  if (error) return false;
  await promoteFromWaitlist(reg.division_id).catch(() => undefined);
  await notifyRegistrantAfterRegistration(reg.id, { kind: "payment_hold_expired" }).catch(() => undefined);
  return true;
}

/**
 * Cancels unpaid online holds past their deadline (online-only tournaments).
 * Safe to call on every roster load / registration attempt.
 */
export async function expireStalePaymentHolds(opts?: { tournamentId?: string; divisionId?: string; registrationId?: string }) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  let query = admin
    .from("registrations")
    .select("id, division_id, tournament_id, tournaments(allow_walk_in_payment)")
    .eq("payment_status", "pending")
    .eq("entry_source", "online")
    .not("status", "eq", "cancelled")
    .not("payment_hold_expires_at", "is", null)
    .lt("payment_hold_expires_at", now);

  if (opts?.registrationId) query = query.eq("id", opts.registrationId);
  if (opts?.divisionId) query = query.eq("division_id", opts.divisionId);
  if (opts?.tournamentId) query = query.eq("tournament_id", opts.tournamentId);

  const { data } = await query;
  const released: string[] = [];

  for (const row of data ?? []) {
    const t = row.tournaments as { allow_walk_in_payment: boolean } | { allow_walk_in_payment: boolean }[];
    const tour = Array.isArray(t) ? t[0] : t;
    if (tour?.allow_walk_in_payment) continue;
    if (await releaseOneHold(row, admin)) released.push(row.id);
  }

  return released;
}