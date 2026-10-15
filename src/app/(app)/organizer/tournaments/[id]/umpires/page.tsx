import { getAppUrl } from "@/lib/env/server";
import { requireOrganizerForTournament } from "@/lib/auth/require-organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  UmpireRosterPanel,
  type PoolRow,
  type RosterUmpire,
} from "@/components/organizer/umpire-roster-panel";

export default async function UmpiresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOrganizerForTournament(id);
  const admin = createAdminClient();

  const [{ data: umpires }, { data: matchStats }, { data: divisions }, { data: poolMatches }, { data: poolAssign }] =
    await Promise.all([
      admin
        .from("tournament_umpires")
        .select("id, name, active")
        .eq("tournament_id", id)
        .order("created_at"),
      admin
        .from("matches")
        .select("assigned_umpire_id, status")
        .eq("tournament_id", id)
        .not("assigned_umpire_id", "is", null)
        .in("status", ["completed", "walkover"]),
      admin.from("tournament_divisions").select("id, name").eq("tournament_id", id).order("sort_order"),
      admin
        .from("matches")
        .select("division_id, pool")
        .eq("tournament_id", id)
        .not("pool", "is", null),
      admin.from("umpire_pool_assignments").select("division_id, pool, umpire_id").eq("tournament_id", id),
    ]);

  const counts = new Map<string, { completed: number; walkover: number }>();
  for (const m of matchStats ?? []) {
    const uid = m.assigned_umpire_id as string;
    const cur = counts.get(uid) ?? { completed: 0, walkover: 0 };
    if (m.status === "walkover") cur.walkover++;
    else cur.completed++;
    counts.set(uid, cur);
  }

  const roster: RosterUmpire[] = (umpires ?? []).map((u) => {
    const c = counts.get(u.id) ?? { completed: 0, walkover: 0 };
    return {
      id: u.id,
      name: u.name,
      active: u.active,
      gamesCompleted: c.completed,
      gamesWalkover: c.walkover,
    };
  });

  const divisionName = new Map((divisions ?? []).map((d) => [d.id, d.name as string]));
  const poolKeys = new Set<string>();
  for (const m of poolMatches ?? []) {
    if (m.division_id && m.pool) poolKeys.add(`${m.division_id}\0${m.pool}`);
  }
  const assignMap = new Map(
    (poolAssign ?? []).map((a) => [`${a.division_id}\0${a.pool}`, a.umpire_id as string])
  );

  const pools: PoolRow[] = [...poolKeys]
    .map((key) => {
      const [divisionId, pool] = key.split("\0");
      return {
        divisionId,
        divisionName: divisionName.get(divisionId) ?? "Category",
        pool,
        umpireId: assignMap.get(key) ?? null,
      };
    })
    .sort((a, b) => a.divisionName.localeCompare(b.divisionName) || a.pool.localeCompare(b.pool));

  return (
    <UmpireRosterPanel
      tournamentId={id}
      umpireUrl={`${getAppUrl()}/umpire/${id}`}
      umpires={roster}
      pools={pools}
    />
  );
}
