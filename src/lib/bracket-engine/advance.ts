import { BYE, type EngineMatch, type GameScore, type MatchPatch, type Slot } from "./types";

export type AdvanceContext = {
  /** registration id → display name */
  names: Map<string, string>;
  /** registrations that withdrew: their pending matches become walkovers */
  withdrawn?: Set<string>;
};

const DONE = new Set(["completed", "walkover", "cancelled"]);

/** Tracks changed matches so we can return minimal patches. */
class Board {
  private byId: Map<string, EngineMatch>;
  private changed = new Set<string>();
  constructor(matches: EngineMatch[]) {
    // work on copies; callers keep their originals
    this.byId = new Map(matches.map((m) => [m.id, { ...m }]));
  }
  get(id: string | null) {
    return id ? this.byId.get(id) : undefined;
  }
  all() {
    return [...this.byId.values()];
  }
  touch(m: EngineMatch) {
    this.changed.add(m.id);
  }
  patches(): MatchPatch[] {
    return [...this.changed].map((id) => {
      const m = this.byId.get(id)!;
      return {
        id,
        a: m.a,
        b: m.b,
        aLabel: m.aLabel,
        bLabel: m.bLabel,
        status: m.status,
        winner: m.winner,
        gameScores: m.gameScores,
        isConditional: m.isConditional,
      };
    });
  }
  snapshot() {
    return this.all();
  }
}

function place(board: Board, targetId: string | null, slot: Slot | null, regId: string | null, label: string) {
  const t = board.get(targetId);
  if (!t || !slot) return;
  if (slot === "a") {
    t.a = regId;
    t.aLabel = label;
  } else {
    t.b = regId;
    t.bLabel = label;
  }
  board.touch(t);
}

const isDead = (side: string | null, label: string) => !side && label === BYE;

/**
 * Resolves everything that no longer needs a game: byes advance automatically,
 * double byes collapse, and withdrawn teams give their opponents a walkover.
 * Runs until nothing changes.
 */
function settleBoard(board: Board, ctx: AdvanceContext) {
  const withdrawn = ctx.withdrawn ?? new Set<string>();
  for (let guard = 0; guard < 10_000; guard++) {
    let progressed = false;
    for (const m of board.all()) {
      if (m.status !== "scheduled" || m.isConditional) continue;
      const aDead = isDead(m.a, m.aLabel);
      const bDead = isDead(m.b, m.bLabel);

      if (aDead && bDead) {
        m.status = "cancelled";
        m.isBye = true;
        board.touch(m);
        place(board, m.nextMatchId, m.nextSlot, null, BYE);
        place(board, m.loserNextMatchId, m.loserNextSlot, null, BYE);
        progressed = true;
      } else if ((m.a && bDead) || (m.b && aDead)) {
        const w = (m.a ?? m.b)!;
        m.status = "completed";
        m.isBye = true;
        m.winner = w;
        board.touch(m);
        place(board, m.nextMatchId, m.nextSlot, w, ctx.names.get(w) ?? "TBD");
        place(board, m.loserNextMatchId, m.loserNextSlot, null, BYE);
        progressed = true;
      } else if (m.a && m.b && (withdrawn.has(m.a) || withdrawn.has(m.b)) && !started(m)) {
        const w = withdrawn.has(m.a) && !withdrawn.has(m.b) ? m.b : m.a;
        finish(board, m, w, null, "walkover", ctx);
        progressed = true;
      }
    }
    if (!progressed) return;
  }
}

function started(m: EngineMatch) {
  return (m.scoreA ?? 0) > 0 || (m.scoreB ?? 0) > 0 || (m.gamesA ?? 0) > 0 || (m.gamesB ?? 0) > 0;
}

function finish(
  board: Board,
  m: EngineMatch,
  winner: string,
  gameScores: GameScore[] | null,
  status: "completed" | "walkover",
  ctx: AdvanceContext
) {
  const loser = winner === m.a ? m.b : m.a;
  m.status = status;
  m.winner = winner;
  m.gameScores = gameScores;
  board.touch(m);
  place(board, m.nextMatchId, m.nextSlot, winner, ctx.names.get(winner) ?? "TBD");
  place(board, m.loserNextMatchId, m.loserNextSlot, loser, loser ? (ctx.names.get(loser) ?? "TBD") : BYE);

  if (m.stage === "grand_final") {
    const reset = board.all().find((x) => x.stage === "grand_final_reset");
    if (reset) {
      if (winner === m.a) {
        // the unbeaten finalist won: no decider needed
        reset.status = "cancelled";
      } else {
        // first loss for the winners'-side finalist: play the decider
        reset.a = m.a;
        reset.b = m.b;
        reset.aLabel = m.aLabel;
        reset.bLabel = m.bLabel;
        reset.isConditional = false;
        reset.status = "scheduled";
      }
      board.touch(reset);
    }
  }
}

/** Resolves byes/walkovers on a freshly generated stage. Returns the settled matches. */
export function settle(matches: EngineMatch[], ctx: AdvanceContext): EngineMatch[] {
  const board = new Board(matches);
  settleBoard(board, ctx);
  return board.snapshot();
}

/** Applies byes/walkovers to an existing bracket (e.g. after a withdrawal) and returns the changes. */
export function resolvePending(matches: EngineMatch[], ctx: AdvanceContext): MatchPatch[] {
  const board = new Board(matches);
  settleBoard(board, ctx);
  return board.patches();
}

/**
 * Records a result and moves both teams on. Returns patches for every match
 * that changed (including the finished one).
 */
export function applyResult(
  matches: EngineMatch[],
  matchId: string,
  winner: string,
  gameScores: GameScore[] | null,
  ctx: AdvanceContext,
  status: "completed" | "walkover" = "completed"
): MatchPatch[] {
  const board = new Board(matches);
  const m = board.get(matchId);
  if (!m) throw new Error("Match not found");
  if (winner !== m.a && winner !== m.b) throw new Error("Winner must be one of the two sides");
  finish(board, m, winner, gameScores, status, ctx);
  settleBoard(board, ctx);
  return board.patches();
}

/**
 * Undoes a finished result, but only while the matches it fed haven't started
 * (otherwise later results would be built on it). Returns patches or a reason.
 */
export function revertResult(
  matches: EngineMatch[],
  matchId: string
): { patches: MatchPatch[] } | { error: string } {
  const board = new Board(matches);
  const m = board.get(matchId);
  if (!m) return { error: "Match not found" };
  if (!DONE.has(m.status) || m.status === "cancelled") return { error: "This match isn't finished." };
  if (m.isBye) return { error: "Byes can't be reopened." };

  const targets: Array<[EngineMatch | undefined, Slot | null, string]> = [
    [board.get(m.nextMatchId), m.nextSlot, `Winner of M${m.matchNumber}`],
    [board.get(m.loserNextMatchId), m.loserNextSlot, `Loser of M${m.matchNumber}`],
  ];
  for (const [t] of targets) {
    if (t && (DONE.has(t.status) && t.status !== "cancelled" ? true : t.status === "in_progress" || started(t))) {
      return { error: `${t.roundLabel} (M${t.matchNumber}) has already started — correct that one first.` };
    }
  }
  if (m.stage === "grand_final") {
    const reset = board.all().find((x) => x.stage === "grand_final_reset");
    if (reset && (reset.status === "in_progress" || DONE.has(reset.status) && reset.status !== "cancelled" || started(reset))) {
      return { error: "The deciding final has already started." };
    }
    if (reset) {
      reset.a = null;
      reset.b = null;
      reset.aLabel = "If needed";
      reset.bLabel = "If needed";
      reset.isConditional = true;
      reset.status = "scheduled";
      board.touch(reset);
    }
  }

  for (const [t, slot, label] of targets) if (t) place(board, t.id, slot, null, label);
  m.status = "scheduled";
  m.winner = null;
  m.gameScores = null;
  board.touch(m);
  return { patches: board.patches() };
}

/** True once every match of the given stages is decided. */
export function stageDone(matches: EngineMatch[], stages?: Set<string>) {
  return matches
    .filter((m) => !stages || stages.has(m.stage))
    .every((m) => DONE.has(m.status) || (m.isConditional && !m.a && !m.b));
}
