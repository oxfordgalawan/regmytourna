import type { GameScore, MatchStatus } from "@/lib/bracket-engine";

export type MatchScoreState = {
  gameScores: GameScore[] | null;
  gamesWonA: number;
  gamesWonB: number;
  scoreA: number;
  scoreB: number;
  status: MatchStatus;
  currentGame: number;
  winnerRegistrationId: string | null;
  teamARegistrationId: string | null;
  teamBRegistrationId: string | null;
};

export type ReconcileUpdate = {
  gameScores: GameScore[];
  gamesWonA: number;
  gamesWonB: number;
  scoreA: number;
  scoreB: number;
  status: "completed" | "in_progress" | "scheduled";
  currentGame: number;
  winnerRegistrationId: string | null;
  winnerSide: "a" | "b" | null;
  /** Delete match_scores where game_number >= this (1-based). Null if none. */
  trimFromGame: number | null;
};

export type ReconcileResult =
  | { kind: "unchanged" }
  | { kind: "needs_manual"; reason: string }
  | { kind: "update"; update: ReconcileUpdate; winnerChanged: boolean };

function sideWinner(
  side: "a" | "b",
  teamA: string | null,
  teamB: string | null
): string | null {
  return side === "a" ? teamA : teamB;
}

/** Keep recorded games until one side reaches gamesToWin. */
export function truncateGameScores(
  scores: GameScore[],
  gamesToWin: number
): { kept: GameScore[]; gamesWonA: number; gamesWonB: number; winnerSide: "a" | "b" | null } {
  let ga = 0;
  let gb = 0;
  const kept: GameScore[] = [];
  for (const [a, b] of scores) {
    if (a < 0 || b < 0 || a === b) {
      return { kept: [], gamesWonA: 0, gamesWonB: 0, winnerSide: null };
    }
    kept.push([a, b]);
    if (a > b) ga++;
    else gb++;
    if (ga >= gamesToWin || gb >= gamesToWin) {
      return { kept, gamesWonA: ga, gamesWonB: gb, winnerSide: ga > gb ? "a" : "b" };
    }
  }
  return { kept, gamesWonA: ga, gamesWonB: gb, winnerSide: null };
}

function cleanScores(raw: GameScore[] | null): GameScore[] {
  return (raw ?? []).filter(([a, b]) => a > 0 || b > 0);
}

/** Decide how one match row should look under a lower gamesToWin. */
export function reconcileMatchToGamesToWin(state: MatchScoreState, newGamesToWin: number): ReconcileResult {
  if (state.status === "cancelled" || state.status === "walkover") return { kind: "unchanged" };
  if (!state.teamARegistrationId || !state.teamBRegistrationId) return { kind: "unchanged" };

  const scores = cleanScores(state.gameScores);
  const hadExtraGames =
    scores.length > newGamesToWin ||
    state.gamesWonA > newGamesToWin ||
    state.gamesWonB > newGamesToWin ||
    (newGamesToWin === 1 && state.currentGame > 1 && scores.length >= 1) ||
    (state.status === "in_progress" && state.currentGame > scores.length + 1);

  const hadLiveGame =
    state.status === "in_progress" &&
    (state.currentGame > 1 || state.scoreA > 0 || state.scoreB > 0 || state.gamesWonA > 0 || state.gamesWonB > 0);

  if (!scores.length && !hadLiveGame && state.status === "scheduled") return { kind: "unchanged" };
  if (!scores.length && state.status !== "scheduled") {
    return { kind: "needs_manual", reason: "No game scores on record" };
  }

  const { kept, gamesWonA, gamesWonB, winnerSide } = truncateGameScores(scores, newGamesToWin);
  if (!kept.length) {
    return { kind: "needs_manual", reason: "No valid game scores" };
  }
  const matchDecided = winnerSide !== null;
  if (!matchDecided && (state.status === "completed" || hadExtraGames)) {
    return { kind: "needs_manual", reason: "No clear winner under the new format" };
  }

  const newWinnerId = winnerSide ? sideWinner(winnerSide, state.teamARegistrationId, state.teamBRegistrationId) : null;
  const oldWinnerId = state.winnerRegistrationId;
  const winnerChanged = Boolean(
    matchDecided && oldWinnerId && newWinnerId && oldWinnerId !== newWinnerId && state.status === "completed"
  );

  const trimFromGame = kept.length < scores.length || (matchDecided && state.currentGame > kept.length) ? kept.length + 1 : null;

  const unchanged =
    !hadExtraGames &&
    !winnerChanged &&
    kept.length === scores.length &&
    state.gamesWonA === gamesWonA &&
    state.gamesWonB === gamesWonB &&
    !(matchDecided && state.status === "in_progress");

  if (unchanged) return { kind: "unchanged" };

  const update: ReconcileUpdate = {
    gameScores: kept,
    gamesWonA,
    gamesWonB,
    scoreA: 0,
    scoreB: 0,
    status: matchDecided ? "completed" : state.status === "scheduled" ? "scheduled" : "in_progress",
    currentGame: matchDecided ? kept.length + 1 : Math.max(state.currentGame, kept.length + 1),
    winnerRegistrationId: matchDecided ? newWinnerId : null,
    winnerSide: matchDecided ? winnerSide : null,
    trimFromGame,
  };

  return { kind: "update", update, winnerChanged };
}

export type TrimPreviewMatch = {
  matchId: string;
  matchNumber: number;
  roundLabel: string;
  reason?: string;
  winnerChanges: boolean;
};

export type TrimPreview = {
  toUpdate: number;
  winnerChanges: number;
  blocked: TrimPreviewMatch[];
  needsManual: TrimPreviewMatch[];
};
