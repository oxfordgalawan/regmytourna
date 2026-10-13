/**
 * Bracket engine types. Pure data — no database, no React.
 * A "side" is a registration (team or singles player).
 */

export type Slot = "a" | "b";

export type Stage =
  | "pool"
  | "round_robin"
  | "winners"
  | "losers"
  | "grand_final"
  | "grand_final_reset"
  | "third_place"
  | "swiss";

export type MatchStatus = "scheduled" | "in_progress" | "completed" | "walkover" | "cancelled";

/** An entry in seed order (index 0 = top seed). */
export type Entry = { id: string; name: string };

/** One game's final score, side A first: [11, 9]. */
export type GameScore = [number, number];

/** Shared shape for generated matches and matches loaded from the database. */
export type EngineMatch = {
  id: string;
  stage: Stage;
  pool: string | null;
  round: number;
  position: number;
  matchNumber: number;
  roundLabel: string;
  a: string | null;
  b: string | null;
  aLabel: string;
  bLabel: string;
  nextMatchId: string | null;
  nextSlot: Slot | null;
  loserNextMatchId: string | null;
  loserNextSlot: Slot | null;
  /** has a side that will never be filled; the other side advances automatically */
  isBye: boolean;
  /** grand-final decider: only played if the losers'-side finalist wins the first final */
  isConditional: boolean;
  status: MatchStatus;
  winner: string | null;
  gameScores: GameScore[] | null;
  /** live point score / games won — only "started" checks use these */
  scoreA?: number;
  scoreB?: number;
  gamesA?: number;
  gamesB?: number;
};

/** Label used for a slot that will never be filled. */
export const BYE = "Bye";

export type IdFactory = () => string;
export const randomId: IdFactory = () => crypto.randomUUID();

/** A change to one match, keyed by match id. */
export type MatchPatch = { id: string } & Partial<
  Pick<EngineMatch, "a" | "b" | "aLabel" | "bLabel" | "status" | "winner" | "gameScores" | "isConditional">
>;
