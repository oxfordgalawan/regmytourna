import { createAdminClient } from "@/lib/supabase/admin";
import { relationOne } from "@/lib/supabase/relations";
import { teamKey, type ImportCategory } from "@/lib/import/players";

const ACTIVE = ["confirmed", "awaiting_payment", "pending", "awaiting_partner", "waitlisted"];

/** The event's categories and who's already in each, for import checks. */
export async function loadImportContext(tournamentId: string) {
  const admin = createAdminClient();
  const [{ data: tournament }, { data: divisions }, { data: regs }] = await Promise.all([
    admin.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
    admin
      .from("tournament_divisions")
      .select("id, name, format, capacity, bracket_state, sort_order")
      .eq("tournament_id", tournamentId)
      .order("sort_order"),
    admin
      .from("registrations")
      .select("id, division_id, registration_players(guest_name, is_primary, profiles(full_name))")
      .eq("tournament_id", tournamentId)
      .in("status", ACTIVE),
  ]);

  const categories: ImportCategory[] = (divisions ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    format: d.format,
    capacity: d.capacity,
    drawStarted: Boolean(d.bracket_state && d.bracket_state !== "not_started"),
  }));

  const existing = new Map<string, Set<string>>();
  for (const r of regs ?? []) {
    const names = ((r.registration_players ?? []) as Array<{ guest_name: string | null; profiles: unknown }>).map(
      (p) => (relationOne(p.profiles as never) as { full_name: string | null } | null)?.full_name || p.guest_name || ""
    );
    const set = existing.get(r.division_id) ?? new Set<string>();
    set.add(teamKey(names));
    existing.set(r.division_id, set);
  }

  return { tournament, categories, existing };
}

export type RosterEntry = {
  id: string;
  seed: number | null;
  checkedIn: boolean;
  players: Array<{ rowId: string; name: string; primary: boolean }>;
};
export type RosterCategory = ImportCategory & { entries: RosterEntry[] };

/** The Players tab of a bracket-only event: categories with their entries, seeded first. */
export async function loadRoster(tournamentId: string): Promise<RosterCategory[]> {
  const admin = createAdminClient();
  const { categories } = await loadImportContext(tournamentId);
  const { data: regs } = await admin
    .from("registrations")
    .select("id, division_id, seed, created_at, check_ins(id), registration_players(id, guest_name, is_primary, profiles(full_name))")
    .eq("tournament_id", tournamentId)
    .in("status", ACTIVE)
    .order("created_at", { ascending: true });

  return categories.map((c) => ({
    ...c,
    entries: (regs ?? [])
      .filter((r) => r.division_id === c.id)
      .map((r) => ({
        id: r.id,
        seed: r.seed ?? null,
        checkedIn: Array.isArray(r.check_ins) ? r.check_ins.length > 0 : Boolean(r.check_ins),
        players: ((r.registration_players ?? []) as Array<{
          id: string;
          guest_name: string | null;
          is_primary: boolean;
          profiles: unknown;
        }>)
          .slice()
          .sort((x, y) => Number(y.is_primary) - Number(x.is_primary))
          .map((p) => ({
            rowId: p.id,
            name: (relationOne(p.profiles as never) as { full_name: string | null } | null)?.full_name || p.guest_name || "Player",
            primary: p.is_primary,
          })),
      }))
      .sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999)),
  }));
}
