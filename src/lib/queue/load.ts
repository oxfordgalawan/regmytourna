import { createAdminClient } from "@/lib/supabase/admin";
import { isPlayableMatch } from "@/lib/umpire/playable";

/** The event-wide queue: each court's live match and line, plus matches ready to queue. */

export type QueueMatch = {
  id: string;
  status: string;
  teamA: string;
  teamB: string;
  divisionId: string | null;
  divisionName: string;
  label: string;
  courtId: string | null;
  position: number | null;
  umpireId: string | null;
  umpireName: string | null;
  /** live score (current game) and games won */
  scoreA: number;
  scoreB: number;
  gamesA: number;
  gamesB: number;
};

export type QueueCourt = {
  id: string;
  name: string;
  live: QueueMatch[];
  queued: QueueMatch[];
};

type Row = Record<string, unknown> & {
  id: string;
  status: string;
  court_id: string | null;
  court_queue_position?: number | null;
  match_number: number | null;
  round_label: string | null;
  division_id: string | null;
  team_a_label: string | null;
  team_b_label: string | null;
  assigned_umpire_id: string | null;
  umpire_queue_order: number | null;
  pool: string | null;
};

export async function loadQueue(tournamentId: string) {
  const admin = createAdminClient();
  const [{ data: courts }, { data: divisions }, { data: umpires }, { data: matches }] = await Promise.all([
    admin.from("courts").select("id, name, active, sort_order").eq("tournament_id", tournamentId).order("sort_order"),
    admin.from("tournament_divisions").select("id, name, sort_order").eq("tournament_id", tournamentId).order("sort_order"),
    admin.from("tournament_umpires").select("*").eq("tournament_id", tournamentId).order("name"),
    // "*" so this still loads before the queue migration is applied
    admin
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .in("status", ["scheduled", "in_progress"]),
  ]);

  const divisionName = new Map((divisions ?? []).map((d) => [d.id, d.name as string]));
  const activeUmpires = (umpires ?? []).filter((u) => u.active && !u.deleted_at);
  const umpireName = new Map((umpires ?? []).map((u) => [u.id as string, u.name as string]));

  const toMatch = (m: Row) => rowToQueueMatch(m, divisionName, umpireName);

  const rows = ((matches ?? []) as Row[]).filter(isPlayableMatch);
  const activeCourts = (courts ?? []).filter((c) => c.active !== false);
  const courtIds = new Set(activeCourts.map((c) => c.id));

  const byLine = (a: Row, b: Row) =>
    (a.court_queue_position ?? 9999) - (b.court_queue_position ?? 9999) ||
    (a.match_number ?? 9999) - (b.match_number ?? 9999);

  const queueCourts: QueueCourt[] = activeCourts.map((c) => ({
    id: c.id,
    name: c.name as string,
    live: rows.filter((m) => m.court_id === c.id && m.status === "in_progress").map(toMatch),
    queued: rows
      .filter((m) => m.court_id === c.id && m.status === "scheduled")
      .sort(byLine)
      .map(toMatch),
  }));

  // ready to play: both teams known, not started, not on an (active) court yet
  const divisionOrder = new Map((divisions ?? []).map((d, i) => [d.id, i]));
  const ready = rows
    .filter((m) => m.status === "scheduled" && (!m.court_id || !courtIds.has(m.court_id)))
    .sort(
      (a, b) =>
        (a.umpire_queue_order ?? 9999) - (b.umpire_queue_order ?? 9999) ||
        (a.match_number ?? 9999) - (b.match_number ?? 9999) ||
        (divisionOrder.get(a.division_id ?? "") ?? 0) - (divisionOrder.get(b.division_id ?? "") ?? 0)
    )
    .map(toMatch);

  // live matches with no court (started straight from the umpire hub)
  const liveElsewhere = rows.filter((m) => m.status === "in_progress" && (!m.court_id || !courtIds.has(m.court_id))).map(toMatch);

  return {
    courts: queueCourts,
    ready,
    liveElsewhere,
    umpires: activeUmpires.map((u) => ({ id: u.id as string, name: u.name as string })),
    categories: (divisions ?? []).map((d) => ({ id: d.id, name: d.name as string })),
  };
}

export type QueueData = Awaited<ReturnType<typeof loadQueue>>;

function rowToQueueMatch(
  m: Row,
  divisionName: Map<string, string>,
  umpireName: Map<string, string>
): QueueMatch {
  return {
    id: m.id,
    status: m.status,
    teamA: m.team_a_label ?? "TBD",
    teamB: m.team_b_label ?? "TBD",
    divisionId: m.division_id,
    divisionName: m.division_id ? (divisionName.get(m.division_id) ?? "Category") : "Category",
    label: [m.pool ? `Pool ${m.pool}` : null, m.round_label ?? (m.match_number ? `Match ${m.match_number}` : null)]
      .filter(Boolean)
      .join(" · "),
    courtId: m.court_id,
    position: m.court_queue_position ?? null,
    umpireId: m.assigned_umpire_id,
    umpireName: m.assigned_umpire_id ? (umpireName.get(m.assigned_umpire_id) ?? "Umpire") : null,
    scoreA: Number(m.score_a ?? 0),
    scoreB: Number(m.score_b ?? 0),
    gamesA: Number(m.games_won_a ?? 0),
    gamesB: Number(m.games_won_b ?? 0),
  };
}

/** Matches this umpire already finished (newest first). */
export async function loadUmpireFinishedMatches(tournamentId: string, umpireId: string) {
  const admin = createAdminClient();
  const [{ data: divisions }, { data: umpires }, { data: matches }] = await Promise.all([
    admin.from("tournament_divisions").select("id, name").eq("tournament_id", tournamentId),
    admin.from("tournament_umpires").select("id, name").eq("tournament_id", tournamentId),
    admin
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("assigned_umpire_id", umpireId)
      .in("status", ["completed", "walkover"])
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);
  const divisionName = new Map((divisions ?? []).map((d) => [d.id, d.name as string]));
  const umpireName = new Map((umpires ?? []).map((u) => [u.id as string, u.name as string]));
  return ((matches ?? []) as Row[]).filter(isPlayableMatch).map((m) => rowToQueueMatch(m, divisionName, umpireName));
}
