import type { CoreSnapshot, Op } from "@/lib/scoring/match-engine";

export function validSnapshot(s: CoreSnapshot | undefined): s is CoreSnapshot {
  if (!s) return false;
  const ints = [s.game, s.scoreA, s.scoreB, s.gamesA, s.gamesB, s.seq];
  return ints.every((n) => Number.isInteger(n) && n >= 0 && n < 10_000) && (s.status === "in_progress" || s.status === "completed");
}

export function pickFreshOps(ops: Op[], applied: number) {
  const fresh = ops.filter((o) => Number.isInteger(o.seq) && o.seq > applied).sort((x, y) => x.seq - y.seq);
  if (!fresh.length) return { fresh: [], last: null as CoreSnapshot | null };
  if (fresh[0].seq !== applied + 1) return { fresh: null, last: null };
  let last: CoreSnapshot | null = null;
  for (const op of fresh) {
    if (!validSnapshot(op.after)) return { fresh: null, last: null, bad: true as const };
    last = op.after;
  }
  return { fresh, last, bad: false as const };
}

export function rowUpdateFromSnapshot(
  s: CoreSnapshot,
  existing: { started_at: string | null; completed_at: string | null },
  firstOpAt: string
) {
  return {
    score_a: s.scoreA,
    score_b: s.scoreB,
    games_won_a: s.gamesA,
    games_won_b: s.gamesB,
    current_game: s.game,
    game_scores: s.gameScores,
    serve_state: s.serve,
    match_setup: s.setup,
    status: s.status === "completed" ? "completed" : "in_progress",
    started_at: existing.started_at ?? firstOpAt,
    completed_at: s.status === "completed" ? (existing.completed_at ?? new Date().toISOString()) : null,
    client_seq: s.seq,
  };
}