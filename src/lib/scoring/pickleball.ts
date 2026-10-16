/**
 * Pickleball side-out scoring. Only the serving side scores. In doubles each
 * team has two serves (server #1, #2) except the first service of a game,
 * which starts on server #2 — the "0-0-2" call. When the serving team wins a
 * rally its two players switch sides; the receivers never move.
 */

export type Side = "a" | "b";

export type ServeState = {
  game: number;
  doubles: boolean;
  serving: Side;
  /** doubles server number (always 1 in singles) */
  server: 1 | 2;
  /** index (0/1) of the serving player within the serving team */
  serverIdx: number;
  /** index of the player standing in each team's right (even) court */
  right: { a: number; b: number };
};

export type MatchSetup = {
  tossWinner: Side;
  firstServe: Side;
  /** each team's base player: starts the game in the right court */
  base: { a: number; b: number };
  /** who served first in game 1 — later games alternate */
  game1Serve?: Side;
};

export type Scores = { a: number; b: number };
export type RallyKind = "point" | "second_server" | "side_out";

export const other = (s: Side): Side => (s === "a" ? "b" : "a");

export function initialServe(game: number, doubles: boolean, firstServe: Side, base: { a: number; b: number }): ServeState {
  return {
    game,
    doubles,
    serving: firstServe,
    server: doubles ? 2 : 1,
    serverIdx: doubles ? base[firstServe] : 0,
    right: doubles ? { ...base } : { a: 0, b: 0 },
  };
}

/** What happens after a rally won by `winner`. */
export function rally(state: ServeState, scores: Scores, winner: Side): { state: ServeState; scores: Scores; kind: RallyKind } {
  const s = state.serving;
  if (winner === s) {
    const right = state.doubles ? { ...state.right, [s]: 1 - state.right[s] } : state.right;
    return { state: { ...state, right }, scores: { ...scores, [s]: scores[s] + 1 }, kind: "point" };
  }
  if (state.doubles && state.server === 1) {
    return { state: { ...state, server: 2, serverIdx: 1 - state.serverIdx }, scores, kind: "second_server" };
  }
  const next = other(s);
  return {
    state: { ...state, serving: next, server: 1, serverIdx: state.doubles ? state.right[next] : 0 },
    scores,
    kind: "side_out",
  };
}

/** The score call: serving score – receiving score (– server number in doubles). */
export function scoreCall(state: ServeState, scores: Scores) {
  const parts = [scores[state.serving], scores[other(state.serving)]];
  if (state.doubles) parts.push(state.server);
  return parts.join("-");
}

/**
 * Court a player stands in. Doubles: tracked positions. Singles: both players
 * line up by the server's score — right when even, left when odd.
 */
export function courtSide(state: ServeState, scores: Scores, team: Side, idx: number): "right" | "left" {
  if (!state.doubles) return scores[state.serving] % 2 === 0 ? "right" : "left";
  return state.right[team] === idx ? "right" : "left";
}

export function isServeState(v: unknown): v is ServeState {
  return Boolean(v && typeof v === "object" && "serving" in v && "right" in v && "game" in v);
}

export const TIMERS = [
  { seconds: 60, label: "Warm-up", short: "1 min" },
  { seconds: 180, label: "Waiting for players", short: "3 min" },
  { seconds: 300, label: "Before default", short: "5 min" },
] as const;

export function timerLabel(seconds: number) {
  return TIMERS.find((t) => t.seconds === seconds)?.label ?? `${Math.round(seconds / 60)} min timer`;
}
