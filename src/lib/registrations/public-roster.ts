import { createAdminClient } from "@/lib/supabase/admin";
import { tidyPersonName } from "@/lib/registrations/name";
import { expireStalePaymentHolds, isPaymentHoldActive } from "@/lib/registrations/payment-hold";

/**
 * Public "who's in" for a category. Shows entrants; unpaid online holds appear as
 * reserved slots (names hidden) with a public countdown until payment or expiry.
 */

const SLOT_STATUSES = ["confirmed", "awaiting_payment", "pending", "awaiting_partner"] as const;

export type PublicRosterPlayer = {
  name: string;
  avatarUrl: string | null;
};

export type PublicRosterEntry = {
  players: PublicRosterPlayer[];
  waitlistPosition?: number | null;
  paymentHold?: { expiresAt: string } | null;
};

type PlayerRow = {
  guest_name: string | null;
  is_primary: boolean | null;
  profiles: { full_name: string | null; avatar_url: string | null } | Array<{ full_name: string | null; avatar_url: string | null }> | null;
};

function toPlayers(rows: PlayerRow[] | null | undefined): PublicRosterPlayer[] {
  return (rows ?? [])
    .slice()
    .sort((x, y) => Number(Boolean(y.is_primary)) - Number(Boolean(x.is_primary)))
    .map((p) => {
      const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const name = prof?.full_name || p.guest_name;
      return name ? { name: tidyPersonName(name), avatarUrl: prof?.avatar_url?.trim() || null } : null;
    })
    .filter((p): p is PublicRosterPlayer => p !== null);
}

export async function loadPublicDivisionRoster(tournamentId: string, divisionId: string) {
  const admin = createAdminClient();

  await expireStalePaymentHolds({ tournamentId, divisionId }).catch(() => undefined);

  const [{ data: division }, { data: tournament }] = await Promise.all([
    admin
      .from("tournament_divisions")
      .select("id, name, capacity, format, tournament_id")
      .eq("id", divisionId)
      .eq("tournament_id", tournamentId)
      .maybeSingle(),
    admin.from("tournaments").select("is_public, allow_walk_in_payment").eq("id", tournamentId).maybeSingle(),
  ]);

  if (!division) return { error: "Category not found." as const };
  if (!tournament?.is_public) return { error: "Not available." as const };

  const { data: regs } = await admin
    .from("registrations")
    .select(
      "id, status, waitlist_position, payment_status, entry_source, payment_hold_expires_at, registration_players(guest_name, is_primary, profiles(full_name, avatar_url))"
    )
    .eq("tournament_id", tournamentId)
    .eq("division_id", divisionId)
    .in("status", [...SLOT_STATUSES, "waitlisted"])
    .order("created_at", { ascending: true });

  const slots: PublicRosterEntry[] = [];
  const waitlist: PublicRosterEntry[] = [];

  for (const r of regs ?? []) {
    if (r.status === "waitlisted") {
      const players = toPlayers(r.registration_players as PlayerRow[]);
      if (!players.length) continue;
      waitlist.push({ players, waitlistPosition: r.waitlist_position });
      continue;
    }

    const holdActive =
      !tournament.allow_walk_in_payment &&
      isPaymentHoldActive({
        payment_hold_expires_at: r.payment_hold_expires_at,
        payment_status: r.payment_status,
        entry_source: r.entry_source,
      });

    if (holdActive && r.payment_hold_expires_at) {
      slots.push({
        players: [],
        paymentHold: { expiresAt: r.payment_hold_expires_at },
      });
      continue;
    }

    const players = toPlayers(r.registration_players as PlayerRow[]);
    if (!players.length) continue;
    slots.push({ players });
  }
  waitlist.sort((a, b) => (a.waitlistPosition ?? 999) - (b.waitlistPosition ?? 999));

  return {
    divisionName: division.name as string,
    format: division.format as string,
    capacity: division.capacity as number | null,
    slots,
    waitlist,
    taken: slots.length,
    onlinePaymentHoldMinutes: tournament.allow_walk_in_payment ? null : 30,
  };
}