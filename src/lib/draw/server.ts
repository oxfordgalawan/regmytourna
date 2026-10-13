import { createAdminClient } from "@/lib/supabase/admin";
import { parseBracketConfig, type BracketConfig } from "@/lib/bracket-format";
import { REGISTRATION_PLAYERS_SELECT, registrationName } from "@/lib/registrations/name";
import type { EngineMatch, Entry, GameScore, MatchPatch, Stage } from "@/lib/bracket-engine";

/** Database adapter for the bracket engine (server only — uses the service role). */

export const MATCH_SELECT =
  "id, tournament_id, division_id, court_id, stage, pool, round, position, match_number, round_label, team_a_registration_id, team_b_registration_id, team_a_label, team_b_label, next_match_id, next_slot, loser_next_match_id, loser_next_slot, is_bye, is_conditional, status, winner_registration_id, game_scores, score_a, score_b, games_won_a, games_won_b";

type MatchRow = Record<string, unknown> & { id: string };

export function rowToEngine(r: MatchRow): EngineMatch {
  return {
    id: r.id,
    stage: (r.stage as Stage) ?? "round_robin",
    pool: (r.pool as string) ?? null,
    round: (r.round as number) ?? 1,
    position: (r.position as number) ?? 0,
    matchNumber: (r.match_number as number) ?? 0,
    roundLabel: (r.round_label as string) ?? "",
    a: (r.team_a_registration_id as string) ?? null,
    b: (r.team_b_registration_id as string) ?? null,
    aLabel: (r.team_a_label as string) ?? "TBD",
    bLabel: (r.team_b_label as string) ?? "TBD",
    nextMatchId: (r.next_match_id as string) ?? null,
    nextSlot: (r.next_slot as "a" | "b") ?? null,
    loserNextMatchId: (r.loser_next_match_id as string) ?? null,
    loserNextSlot: (r.loser_next_slot as "a" | "b") ?? null,
    isBye: Boolean(r.is_bye),
    isConditional: Boolean(r.is_conditional),
    status: (r.status as EngineMatch["status"]) ?? "scheduled",
    winner: (r.winner_registration_id as string) ?? null,
    gameScores: (r.game_scores as GameScore[]) ?? null,
    scoreA: (r.score_a as number) ?? 0,
    scoreB: (r.score_b as number) ?? 0,
    gamesA: (r.games_won_a as number) ?? 0,
    gamesB: (r.games_won_b as number) ?? 0,
  };
}

function engineToRow(m: EngineMatch, tournamentId: string, divisionId: string) {
  return {
    id: m.id,
    tournament_id: tournamentId,
    division_id: divisionId,
    stage: m.stage,
    pool: m.pool,
    round: m.round,
    position: m.position,
    match_number: m.matchNumber,
    round_label: m.roundLabel,
    team_a_registration_id: m.a,
    team_b_registration_id: m.b,
    team_a_label: m.aLabel,
    team_b_label: m.bLabel,
    next_match_id: m.nextMatchId,
    next_slot: m.nextSlot,
    loser_next_match_id: m.loserNextMatchId,
    loser_next_slot: m.loserNextSlot,
    is_bye: m.isBye,
    is_conditional: m.isConditional,
    status: m.status,
    winner_registration_id: m.winner,
    game_scores: m.gameScores,
    completed_at: m.status === "completed" || m.status === "walkover" ? new Date().toISOString() : null,
  };
}

function patchToRow(p: MatchPatch) {
  const row: Record<string, unknown> = {};
  if ("a" in p) row.team_a_registration_id = p.a;
  if ("b" in p) row.team_b_registration_id = p.b;
  if ("aLabel" in p) row.team_a_label = p.aLabel;
  if ("bLabel" in p) row.team_b_label = p.bLabel;
  if ("status" in p) {
    row.status = p.status;
    row.completed_at = p.status === "completed" || p.status === "walkover" ? new Date().toISOString() : null;
  }
  if ("winner" in p) row.winner_registration_id = p.winner;
  if ("gameScores" in p) row.game_scores = p.gameScores;
  if ("isConditional" in p) row.is_conditional = p.isConditional;
  return row;
}

export type DivisionContext = {
  division: {
    id: string;
    tournament_id: string;
    name: string;
    format: string;
    capacity: number | null;
    bracket_state: string;
    bracket_started_at: string | null;
    challonge_tournament_id: string | null;
    challonge_url: string | null;
  };
  config: BracketConfig;
  /** confirmed, non-withdrawn entries in seed order */
  entries: Entry[];
  /** every confirmed entry incl. withdrawn, for names and the seeding board */
  allEntries: Array<Entry & { seed: number | null; withdrawn: boolean; createdAt: string }>;
  withdrawn: Set<string>;
  names: Map<string, string>;
  matches: EngineMatch[];
};

export async function loadDivisionContext(divisionId: string): Promise<DivisionContext | null> {
  const admin = createAdminClient();
  const { data: division } = await admin
    .from("tournament_divisions")
    .select("id, tournament_id, name, format, capacity, bracket_config, bracket_state, bracket_started_at, challonge_tournament_id, challonge_url")
    .eq("id", divisionId)
    .maybeSingle();
  if (!division) return null;

  const [{ data: regs }, { data: matchRows }] = await Promise.all([
    admin
      .from("registrations")
      .select(`id, seed, created_at, withdrawn_at, ${REGISTRATION_PLAYERS_SELECT}`)
      .eq("division_id", divisionId)
      .eq("status", "confirmed"),
    admin.from("matches").select(MATCH_SELECT).eq("division_id", divisionId),
  ]);

  const allEntries = (regs ?? [])
    .map((r) => ({
      id: r.id as string,
      name: registrationName(r),
      seed: (r.seed as number | null) ?? null,
      withdrawn: Boolean(r.withdrawn_at),
      createdAt: r.created_at as string,
    }))
    .sort(
      (x, y) =>
        (x.seed ?? Number.MAX_SAFE_INTEGER) - (y.seed ?? Number.MAX_SAFE_INTEGER) ||
        x.createdAt.localeCompare(y.createdAt)
    );

  return {
    division: { ...division, bracket_state: division.bracket_state ?? "not_started" },
    config: parseBracketConfig(division.bracket_config, division.capacity ?? allEntries.length),
    entries: allEntries.filter((e) => !e.withdrawn).map(({ id, name }) => ({ id, name })),
    allEntries,
    withdrawn: new Set(allEntries.filter((e) => e.withdrawn).map((e) => e.id)),
    names: new Map(allEntries.map((e) => [e.id, e.name])),
    matches: (matchRows ?? []).map((r) => rowToEngine(r as MatchRow)),
  };
}

/**
 * Inserts generated matches. Rows referenced by next_match_id go in first, so
 * foreign keys are satisfied regardless of how the database checks them.
 */
export async function insertMatches(matches: EngineMatch[], tournamentId: string, divisionId: string) {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const done = new Set<string>();
  const ordered: EngineMatch[] = [];
  const visit = (m: EngineMatch) => {
    if (done.has(m.id)) return;
    done.add(m.id);
    for (const t of [m.nextMatchId, m.loserNextMatchId]) {
      const target = t ? byId.get(t) : undefined;
      if (target) visit(target);
    }
    ordered.push(m);
  };
  matches.forEach(visit);
  const { error } = await createAdminClient()
    .from("matches")
    .insert(ordered.map((m) => engineToRow(m, tournamentId, divisionId)));
  if (error) throw new Error(error.message);
}

export async function writePatches(patches: MatchPatch[]) {
  const admin = createAdminClient();
  for (const p of patches) {
    const { error } = await admin.from("matches").update(patchToRow(p)).eq("id", p.id);
    if (error) throw new Error(error.message);
  }
}

export async function setDivisionState(divisionId: string, state: string, extra: Record<string, unknown> = {}) {
  await createAdminClient()
    .from("tournament_divisions")
    .update({ bracket_state: state, ...extra })
    .eq("id", divisionId);
}

export function nextMatchNumber(matches: EngineMatch[]) {
  return Math.max(0, ...matches.map((m) => m.matchNumber)) + 1;
}
