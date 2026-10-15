import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The public "who's in" list for a category. Deliberately shows only who
 * entered (names + profile photos) — never payment state.
 */

const SLOT_STATUSES = ["confirmed", "awaiting_payment", "pending", "awaiting_partner"] as const;

export type PublicRosterPlayer = {
  name: string;
  avatarUrl: string | null;
};

export type PublicRosterEntry = {
  players: PublicRosterPlayer[];
  waitlistPosition?: number | null;
};

type PlayerRow = {
  guest_name: string | null;
  is_primary: boolean | null;
  profiles: { full_name: string | null; avatar_url: string | null } | Array<{ full_name: string | null; avatar_url: string | null }> | null;
};

/** "ANDREW FUERZAS" → "Andrew Fuerzas"; leaves normal casing alone. */
function tidyName(name: string) {
  const n = name.trim().replace(/\s+/g, " ");
  if (n !== n.toUpperCase() && n !== n.toLowerCase()) return n;
  return n.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function toPlayers(rows: PlayerRow[] | null | undefined): PublicRosterPlayer[] {
  return (rows ?? [])
    .slice()
    .sort((x, y) => Number(Boolean(y.is_primary)) - Number(Boolean(x.is_primary)))
    .map((p) => {
      const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const name = prof?.full_name || p.guest_name;
      return name ? { name: tidyName(name), avatarUrl: prof?.avatar_url?.trim() || null } : null;
    })
    .filter((p): p is PublicRosterPlayer => p !== null);
}

export async function loadPublicDivisionRoster(tournamentId: string, divisionId: string) {
  const admin = createAdminClient();

  const [{ data: division }, { data: tournament }] = await Promise.all([
    admin
      .from("tournament_divisions")
      .select("id, name, capacity, format, tournament_id")
      .eq("id", divisionId)
      .eq("tournament_id", tournamentId)
      .maybeSingle(),
    admin.from("tournaments").select("is_public").eq("id", tournamentId).maybeSingle(),
  ]);

  if (!division) return { error: "Category not found." as const };
  if (!tournament?.is_public) return { error: "Not available." as const };

  const { data: regs } = await admin
    .from("registrations")
    .select("id, status, waitlist_position, created_at, registration_players(guest_name, is_primary, profiles(full_name, avatar_url))")
    .eq("tournament_id", tournamentId)
    .eq("division_id", divisionId)
    .in("status", [...SLOT_STATUSES, "waitlisted"])
    .order("created_at", { ascending: true });

  const slots: PublicRosterEntry[] = [];
  const waitlist: PublicRosterEntry[] = [];

  for (const r of regs ?? []) {
    const players = toPlayers(r.registration_players as PlayerRow[]);
    if (!players.length) continue;
    if (r.status === "waitlisted") waitlist.push({ players, waitlistPosition: r.waitlist_position });
    else slots.push({ players });
  }
  waitlist.sort((a, b) => (a.waitlistPosition ?? 999) - (b.waitlistPosition ?? 999));

  return {
    divisionName: division.name as string,
    format: division.format as string,
    capacity: division.capacity as number | null,
    slots,
    waitlist,
    taken: slots.length,
  };
}
