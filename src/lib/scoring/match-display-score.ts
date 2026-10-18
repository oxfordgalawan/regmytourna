import type { EngineMatch } from "@/lib/bracket-engine";
import { truncateGameScores } from "@/lib/scoring/reconcile-games-to-win";

const DONE = new Set(["completed", "walkover"]);

function cleanGameScores(scores: EngineMatch["gameScores"]): [number, number][] {
  return (scores ?? []).filter(([a, b]) => a > 0 || b > 0);
}

/** Completed-match score line for dialogs and summaries (respects current games-to-win). */
export function formatCompletedMatchScoreLine(m: EngineMatch, gamesToWin: number): string | null {
  if (!DONE.has(m.status)) return null;

  const scores = cleanGameScores(m.gameScores);
  if (gamesToWin === 1) {
    const { kept } = truncateGameScores(scores, 1);
    if (kept[0]) return `${kept[0][0]}–${kept[0][1]}`;
    return `${m.scoreA ?? 0}–${m.scoreB ?? 0}`;
  }

  if (scores.length) {
    const { kept } = truncateGameScores(scores, gamesToWin);
    const line = (kept.length ? kept : scores).map(([a, b]) => `${a}–${b}`).join(", ");
    return line || null;
  }

  return `${m.gamesA ?? 0}–${m.gamesB ?? 0}`;
}

/** Right-hand score on draw match cards (games won vs rally points for Best of 1). */
export function matchSideDisplayScore(
  m: EngineMatch,
  side: "a" | "b",
  gamesToWin: number
): { text: string; show: boolean } {
  if (m.isBye || m.status === "cancelled") return { text: "", show: false };

  const live = m.status === "in_progress";
  const done = DONE.has(m.status);
  if (!live && !done) return { text: "", show: false };

  const games = side === "a" ? (m.gamesA ?? 0) : (m.gamesB ?? 0);
  const rally = side === "a" ? (m.scoreA ?? 0) : (m.scoreB ?? 0);
  const firstGame = m.gameScores?.[0];

  if (gamesToWin === 1) {
    if (done && firstGame) {
      const pts = side === "a" ? firstGame[0] : firstGame[1];
      return { text: String(pts), show: true };
    }
    if (live) return { text: String(rally), show: true };
    if (done) return { text: String(games), show: true };
    return { text: "", show: false };
  }

  if (live) return { text: `${games}·${rally}`, show: true };
  return { text: String(games), show: true };
}

export type MatchScoreFields = Pick<
  EngineMatch,
  "status" | "scoreA" | "scoreB" | "gamesA" | "gamesB" | "gameScores"
>;

export function matchScoreFieldsFromRow(row: {
  status: string;
  score_a: number;
  score_b: number;
  games_won_a: number;
  games_won_b: number;
  game_scores: unknown;
}): MatchScoreFields {
  return {
    status: row.status as EngineMatch["status"],
    scoreA: row.score_a ?? 0,
    scoreB: row.score_b ?? 0,
    gamesA: row.games_won_a ?? 0,
    gamesB: row.games_won_b ?? 0,
    gameScores: Array.isArray(row.game_scores) ? (row.game_scores as [number, number][]) : null,
  };
}

/** One-line score for organizer matches table and similar lists. */
export function formatMatchScoreSummary(m: MatchScoreFields, gamesToWin: number): string | null {
  if (m.status === "scheduled" || m.status === "cancelled") return null;

  if (m.status === "in_progress") {
    if (gamesToWin === 1) return `${m.scoreA ?? 0}–${m.scoreB ?? 0}`;
    return `${m.gamesA ?? 0}–${m.gamesB ?? 0} · ${m.scoreA ?? 0}–${m.scoreB ?? 0}`;
  }

  if (DONE.has(m.status)) {
    return formatCompletedMatchScoreLine({ ...m, isBye: false } as EngineMatch, gamesToWin);
  }

  return null;
}
