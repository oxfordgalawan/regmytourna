import { createAdminClient } from "@/lib/supabase/admin";
import { notifyRegistrantAfterRegistration } from "@/lib/registrations/registrant-notify";
import { notifyPartnerAfterRegistration } from "@/lib/registrations/partner-notify";

/**
 * Slots and the waitlist. An entry holds a slot while it's confirmed or
 * awaiting payment; waitlisted entries never pay until they're moved up.
 */

export const SLOT_STATUSES = ["confirmed", "awaiting_payment", "pending", "awaiting_partner"] as const;

type Admin = ReturnType<typeof createAdminClient>;

/** Entries holding a slot in each category of a tournament. */
export async function slotCounts(tournamentId: string, admin: Admin = createAdminClient()) {
  const { data } = await admin
    .from("registrations")
    .select("division_id, status")
    .eq("tournament_id", tournamentId)
    .in("status", [...SLOT_STATUSES, "waitlisted"]);
  const counts: Record<string, { taken: number; waitlist: number }> = {};
  for (const r of data ?? []) {
    const c = (counts[r.division_id] ??= { taken: 0, waitlist: 0 });
    if (r.status === "waitlisted") c.waitlist++;
    else c.taken++;
  }
  return counts;
}

export async function takenInDivision(divisionId: string, admin: Admin = createAdminClient()) {
  const { count } = await admin
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("division_id", divisionId)
    .in("status", [...SLOT_STATUSES]);
  return count ?? 0;
}

export async function nextWaitlistPosition(divisionId: string, admin: Admin = createAdminClient()) {
  const { data } = await admin
    .from("registrations")
    .select("waitlist_position")
    .eq("division_id", divisionId)
    .eq("status", "waitlisted")
    .order("waitlist_position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return (data?.waitlist_position ?? 0) + 1;
}

/** Keeps waitlist numbers 1, 2, 3… after someone leaves or moves up. */
async function renumber(divisionId: string, admin: Admin) {
  const { data } = await admin
    .from("registrations")
    .select("id, waitlist_position")
    .eq("division_id", divisionId)
    .eq("status", "waitlisted")
    .order("waitlist_position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  await Promise.all(
    (data ?? []).map((r, i) =>
      r.waitlist_position === i + 1
        ? null
        : admin.from("registrations").update({ waitlist_position: i + 1 }).eq("id", r.id)
    )
  );
}

/**
 * Moves waitlisted entries into free slots, first come first served, and
 * emails each one to choose how to pay. Call after any slot frees up.
 */
export async function promoteFromWaitlist(divisionId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data: division } = await admin
    .from("tournament_divisions")
    .select("id, capacity, entry_fee_cents, tournaments(entry_fee_cents)")
    .eq("id", divisionId)
    .maybeSingle();
  if (!division) return [];

  const t = (Array.isArray(division.tournaments) ? division.tournaments[0] : division.tournaments) as {
    entry_fee_cents: number;
  } | null;
  const fee = division.entry_fee_cents ?? t?.entry_fee_cents ?? 0;
  const promoted: string[] = [];

  for (;;) {
    if (division.capacity && (await takenInDivision(divisionId, admin)) >= division.capacity) break;
    const { data: next } = await admin
      .from("registrations")
      .select("id")
      .eq("division_id", divisionId)
      .eq("status", "waitlisted")
      .order("waitlist_position", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!next) break;

    // only the request that flips it from "waitlisted" wins
    const { data: moved } = await admin
      .from("registrations")
      .update({
        status: fee > 0 ? "awaiting_payment" : "confirmed",
        payment_status: fee > 0 ? "pending" : "paid",
        entry_source: "online",
        waitlist_position: null,
      })
      .eq("id", next.id)
      .eq("status", "waitlisted")
      .select("id");
    if (!moved?.length) continue;
    promoted.push(next.id);
  }

  await renumber(divisionId, admin);

  for (const id of promoted) {
    await notifyRegistrantAfterRegistration(id, { kind: "promoted" }).catch(() => undefined);
    // free entries are final right away, so the partner hears now; paid ones once they pay or pick the venue
    if (fee <= 0) await notifyPartnerAfterRegistration(id).catch(() => undefined);
  }
  return promoted;
}
