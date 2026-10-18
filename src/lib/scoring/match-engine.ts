/**
 * The umpire's phone is the source of truth for a match: every action is an
 * op applied here locally (instant, works offline) and synced to the server
 * later. Ops carry the snapshot they produce, so the server simply records
 * them in order — retries are harmless because each op has a sequence number.
 */
import { initialServe, rally, type MatchSetup, type RallyKind, type ServeState, type Side } from "./pickleball";

export type CoreSnapshot = {
  game: number;
  scoreA: number;
  scoreB: number;
  gamesA: number;
  gamesB: number;
  gameScores: Array<[number, number]>;
  serve: ServeState | null;
  setup: MatchSetup | null;
  status: "in_progress" | "completed";
  /** last op applied */
  seq: number;
};

type UndoEntry = { opId: string; scoreA: number; scoreB: number; serve: ServeState | null };

/** Client-side snapshot: the core plus this game's undo stack. */
export type Snapshot = CoreSnapshot & { history: UndoEntry[] };

export type TimerEventKind = "started" | "finished" | "stopped";

export type OpInput =
  | { type: "game_started"; payload: { tossWinner: Side; firstServe: Side; base: { a: number; b: number } } }
  | { type: "rally"; payload: { winner: Side } }
  | { type: "undo"; payload: Record<string, never> }
  | { type: "end_game"; payload: Record<string, never> }
  | { type: "timer"; payload: { event: TimerEventKind; seconds: number; elapsed?: number } };

export type Op = OpInput & {
  id: string;
  seq: number;
  /** device time the action happened */
  at: string;
  /** filled in by applyOp */
  meta?: { kind?: RallyKind; undoes?: string; game?: number; winner?: Side };
  after?: CoreSnapshot;
};

export type EngineContext = { doubles: boolean; gamesToWin: number };

export function core(s: Snapshot): CoreSnapshot {
  return {
    game: s.game,
    scoreA: s.scoreA,
    scoreB: s.scoreB,
    gamesA: s.gamesA,
    gamesB: s.gamesB,
    gameScores: s.gameScores,
    serve: s.serve,
    setup: s.setup,
    status: s.status,
    seq: s.seq,
  };
}

/** At 0–0 with no rallies, umpire may reopen toss / serve / base setup. */
export function canReopenSetup(s: Snapshot): boolean {
  return (
    s.status !== "completed" &&
    s.serve !== null &&
    s.serve.game === s.game &&
    s.scoreA === 0 &&
    s.scoreB === 0 &&
    s.history.length === 0
  );
}

/** Why an op can't be applied right now, or null. */
export function rejectReason(s: Snapshot, op: OpInput): string | null {
  if (s.status === "completed" && op.type !== "timer") return "The match is finished.";
  switch (op.type) {
    case "rally":
      return s.serve && s.serve.game === s.game ? null : "Start the game first.";
    case "undo":
      if (s.history.length) return null;
      if (canReopenSetup(s)) return null;
      return "Nothing to undo in this game.";
    case "end_game":
      if (!s.serve) return "Start the game first.";
      return s.scoreA === s.scoreB ? "A game can't end on a tied score." : null;
    case "game_started":
      return s.serve && s.serve.game === s.game ? "This game has already started." : null;
    default:
      return null;
  }
}

/** Applies one op. Returns the new snapshot and the op with its result attached. */
export function applyOp(s: Snapshot, op: Op, ctx: EngineContext): { snapshot: Snapshot; op: Op } {
  let next: Snapshot = { ...s, seq: op.seq };
  const meta: Op["meta"] = {};

  switch (op.type) {
    case "game_started": {
      const { tossWinner, firstServe, base } = op.payload;
      next.serve = initialServe(s.game, ctx.doubles, firstServe, base);
      next.setup = {
        tossWinner: s.setup?.tossWinner ?? tossWinner,
        firstServe,
        base,
        game1Serve: s.setup?.game1Serve ?? firstServe,
      };
      next.history = [];
      meta.game = s.game;
      break;
    }
    case "rally": {
      if (!s.serve) break;
      const r = rally(s.serve, { a: s.scoreA, b: s.scoreB }, op.payload.winner);
      next = {
        ...next,
        scoreA: r.scores.a,
        scoreB: r.scores.b,
        serve: r.state,
        history: [...s.history, { opId: op.id, scoreA: s.scoreA, scoreB: s.scoreB, serve: s.serve }],
      };
      meta.kind = r.kind;
      meta.game = s.game;
      break;
    }
    case "undo": {
      if (canReopenSetup(s)) {
        next = {
          ...next,
          serve: null,
          setup: s.game === 1 && s.gamesA === 0 && s.gamesB === 0 ? null : s.setup,
          history: [],
        };
        meta.game = s.game;
        break;
      }
      const last = s.history[s.history.length - 1];
      if (!last) break;
      next = { ...next, scoreA: last.scoreA, scoreB: last.scoreB, serve: last.serve, history: s.history.slice(0, -1) };
      meta.undoes = last.opId;
      meta.game = s.game;
      break;
    }
    case "end_game": {
      const winner: Side = s.scoreA > s.scoreB ? "a" : "b";
      const gamesA = s.gamesA + (winner === "a" ? 1 : 0);
      const gamesB = s.gamesB + (winner === "b" ? 1 : 0);
      const done = gamesA >= ctx.gamesToWin || gamesB >= ctx.gamesToWin;
      next = {
        ...next,
        gamesA,
        gamesB,
        gameScores: [...s.gameScores, [s.scoreA, s.scoreB]],
        scoreA: 0,
        scoreB: 0,
        game: s.game + 1,
        serve: null,
        history: [],
        status: done ? "completed" : "in_progress",
      };
      meta.game = s.game;
      if (done) meta.winner = gamesA > gamesB ? "a" : "b";
      break;
    }
    case "timer":
      meta.game = s.game;
      break;
  }

  return { snapshot: next, op: { ...op, meta, after: core(next) } };
}
