"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, CloudOff, Flag, Loader2, RefreshCw, Timer, TriangleAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { umpireSignInAction } from "@/app/actions/umpire";
import { GameSetup } from "@/components/scoring/game-setup";
import { MatchTimers, TimerLog, timerRuns, type TimerEvent, type TimerLogFn } from "@/components/scoring/match-timers";
import { PickleballBoard } from "@/components/scoring/pickleball-board";
import { PinEntry } from "@/components/umpire/pin-entry";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getMatchStore, type StoreState } from "@/lib/scoring/offline-store";
import { type CoreSnapshot, type Op, type OpInput } from "@/lib/scoring/match-engine";
import { isServeState, other, rally, type MatchSetup } from "@/lib/scoring/pickleball";
import type { CourtPlayer } from "@/lib/scoring/officiating";
import type { Match } from "@/types/database";
import { NAV_BACK } from "@/lib/nav-transitions";
import { cn } from "@/lib/utils";

type ServerMatch = Match & {
  serve_state?: unknown;
  match_setup?: MatchSetup | null;
  client_seq?: number | null;
  game_scores?: Array<[number, number]> | null;
};

function serverSnapshot(m: ServerMatch): CoreSnapshot {
  const serve = isServeState(m.serve_state) && m.serve_state.game === m.current_game ? m.serve_state : null;
  return {
    game: m.current_game,
    scoreA: m.score_a,
    scoreB: m.score_b,
    gamesA: m.games_won_a,
    gamesB: m.games_won_b,
    gameScores: Array.isArray(m.game_scores) ? m.game_scores : [],
    serve,
    setup: m.match_setup ?? null,
    status: m.status === "completed" ? "completed" : "in_progress",
    seq: m.client_seq ?? 0,
  };
}

/** Local timer ops as log events (these exist before they reach the server). */
function timerOpEvents(ops: Op[]): TimerEvent[] {
  return ops.flatMap((o) =>
    o.type === "timer"
      ? [{ id: o.id, kind: `timer_${o.payload.event}`, payload: { ...o.payload }, operatorLabel: "This phone", createdAt: o.at }]
      : []
  );
}

export function PickleballScoring({
  match,
  tournamentId,
  courtName,
  divisionName,
  backHref,
  doubles,
  gamesToWin,
  players,
  events,
}: {
  match: ServerMatch;
  tournamentId: string;
  courtName: string;
  divisionName?: string;
  backHref: string;
  doubles: boolean;
  gamesToWin: number;
  players: { a: CourtPlayer[]; b: CourtPlayer[] };
  events: Array<TimerEvent & { clientOpId?: string | null }>;
}) {
  const router = useRouter();
  const server = useMemo(() => serverSnapshot(match), [match]);
  const store = useMemo(() => getMatchStore(match.id, server, { doubles, gamesToWin }), [match.id, server, doubles, gamesToWin]);
  const serverState = useMemo<StoreState>(
    () => ({ snapshot: { ...server, history: [] }, pending: [], timerLog: [], status: "synced", message: null, discarded: 0 }),
    [server]
  );
  const st = useSyncExternalStore(store.subscribe, store.getState, () => serverState);
  const snap = st.snapshot;

  const [endOpen, setEndOpen] = useState(false);
  const [timersOpen, setTimersOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [lastCall, setLastCall] = useState<string | null>(null);

  useEffect(() => {
    if (st.discarded) toast.warning(`${st.discarded} unsynced action(s) on this phone were replaced by newer scores from the server.`);
  }, [st.discarded]);

  const dispatch = useCallback(
    (op: OpInput) => {
      const error = store.dispatch(op);
      if (error) toast.error(error);
      return error;
    },
    [store]
  );

  const onTimer = useCallback<TimerLogFn>(
    (event, seconds, elapsed) => {
      dispatch({ type: "timer", payload: { event, seconds, ...(elapsed != null ? { elapsed: Math.round(elapsed) } : {}) } });
    },
    [dispatch]
  );

  // server log + this phone's timer ops, without duplicates
  const timerEvents = useMemo(() => {
    const local = timerOpEvents(st.timerLog);
    const ids = new Set(local.map((e) => e.id));
    return [...events.filter((e) => !e.clientOpId || !ids.has(e.clientOpId)), ...local].sort((x, y) =>
      x.createdAt.localeCompare(y.createdAt)
    );
  }, [events, st.timerLog]);

  const teams = {
    a: { side: "a" as const, label: match.team_a_label, players: fill(players.a, doubles), games: snap.gamesA },
    b: { side: "b" as const, label: match.team_b_label, players: fill(players.b, doubles), games: snap.gamesB },
  };

  function point(winner: "a" | "b") {
    if (!snap.serve) return;
    if (navigator.vibrate) navigator.vibrate(15);
    const kind = rally(snap.serve, { a: snap.scoreA, b: snap.scoreB }, winner).kind;
    if (!dispatch({ type: "rally", payload: { winner } })) {
      setLastCall(kind === "point" ? "Point" : kind === "side_out" ? "Side out" : "Second server");
    }
  }

  function endGame() {
    if (!dispatch({ type: "end_game", payload: {} })) setEndOpen(false);
  }

  const serve = snap.serve;
  const servingTeam = serve ? teams[serve.serving] : null;
  const faultResult = serve ? (serve.doubles && serve.server === 1 ? "2nd server" : "Side out") : "";
  const pending = st.pending.length;

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={backHref}
          transitionTypes={NAV_BACK}
          onClick={(e) => {
            if (pending) {
              e.preventDefault();
              setLeaveOpen(true);
            }
          }}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-bone"
        >
          <ArrowLeft className="size-4" />
          All matches
        </Link>
        <SyncPill state={st} onRetry={store.retry} onSignIn={() => setSignInOpen(true)} />
      </div>

      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2 text-bone">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-rust" />
            {courtName}
          </p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {match.round_label ?? `Match ${match.match_number ?? "—"}`}
            {divisionName ? ` · ${divisionName}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow">Game</p>
          <p className="display text-3xl text-bone">{snap.status === "completed" ? snap.game - 1 : snap.game}</p>
        </div>
      </header>

      {st.status === "conflict" && (
        <div className="mt-4 flex gap-3 rounded-xl border border-rust/50 bg-rust/10 p-3 text-sm text-bone">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#e58a72]" />
          <p>
            {st.message} Scoring still works on this phone, but it can&apos;t sync. Show this screen to the organizer.
          </p>
        </div>
      )}

      {snap.status === "completed" ? (
        <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-3xl border border-umber bg-espresso p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-bone text-ink">
            <Check className="size-6" strokeWidth={3} />
          </span>
          <p className="display mt-5 text-4xl text-bone">Match finished</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {pending ? "Result saved on this phone — it posts as soon as you're online." : "Result posted."}
          </p>
          <div className="mt-4 grid w-full max-w-xs grid-cols-2 gap-3">
            {[teams.a, teams.b].map((t) => (
              <div key={t.side} className="rounded-xl border border-line bg-surface p-3">
                <p className="truncate text-sm text-bone/80">{t.label}</p>
                <p className="display text-5xl text-bone">{t.games}</p>
              </div>
            ))}
          </div>
          {snap.gameScores.length > 0 && (
            <p className="mt-3 font-mono text-xs text-muted-foreground">{snap.gameScores.map(([a, b]) => `${a}–${b}`).join(" · ")}</p>
          )}
          <div className="mt-6 w-full max-w-sm text-left">
            <TimerLog runs={timerRuns(timerEvents)} />
          </div>
          <Button size="lg" className="mt-8" onClick={() => (pending ? setLeaveOpen(true) : router.push(backHref))}>
            Next match
          </Button>
        </div>
      ) : !serve ? (
        <GameSetup
          key={snap.game}
          game={snap.game}
          doubles={doubles}
          teams={[
            { side: "a", label: teams.a.label, players: teams.a.players },
            { side: "b", label: teams.b.label, players: teams.b.players },
          ]}
          setup={snap.setup}
          events={timerEvents}
          onTimer={onTimer}
          onStart={(input) => dispatch({ type: "game_started", payload: input })}
        />
      ) : (
        <div className="mt-4 flex flex-1 flex-col gap-3">
          <PickleballBoard
            state={serve}
            scores={{ a: snap.scoreA, b: snap.scoreB }}
            teams={teams}
            base={snap.setup?.base ?? null}
            lastCall={lastCall ? { text: lastCall, key: snap.seq } : null}
          />

          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" className="h-16 flex-col gap-0 text-base" onClick={() => point(serve.serving)}>
              Point
              <span className="max-w-full truncate text-xs font-normal opacity-70">{servingTeam?.label}</span>
            </Button>
            <Button size="lg" variant="outline" className="h-16 flex-col gap-0 border-rust/50 text-base" onClick={() => point(other(serve.serving))}>
              Fault
              <span className="text-xs font-normal text-muted-foreground">{faultResult}</span>
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              disabled={!snap.history.length}
              onClick={() => {
                if (!dispatch({ type: "undo", payload: {} })) setLastCall("Undone");
              }}
            >
              <Undo2 />
              Undo
            </Button>
            <Button variant="outline" onClick={() => setTimersOpen(true)}>
              <Timer />
              Timer
            </Button>
            <Button variant="umber" onClick={() => setEndOpen(true)}>
              <Flag />
              End game
            </Button>
          </div>
        </div>
      )}

      <Dialog open={timersOpen} onOpenChange={setTimersOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Timers</DialogTitle>
            <DialogDescription>Each run is saved to the match record — on this phone first, then synced.</DialogDescription>
          </DialogHeader>
          <MatchTimers events={timerEvents} onLog={onTimer} />
        </DialogContent>
      </Dialog>

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              End game {snap.game} at {snap.scoreA}–{snap.scoreB}?
            </DialogTitle>
            <DialogDescription>
              {teams.a.label} {snap.scoreA} · {teams.b.label} {snap.scoreB}. This records the game score; if the match is
              decided, the result is posted (as soon as this phone is online).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndOpen(false)}>
              Keep playing
            </Button>
            <Button onClick={endGame}>Confirm result</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scores not synced yet</DialogTitle>
            <DialogDescription>
              {pending} action{pending === 1 ? " is" : "s are"} saved on this phone and will sync when you&apos;re back
              online. Come back to this match to finish syncing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>
              Stay
            </Button>
            <Button onClick={() => router.push(backHref)}>Leave anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign in to sync</DialogTitle>
            <DialogDescription>Your scores are safe on this phone. Enter your PIN to keep syncing.</DialogDescription>
          </DialogHeader>
          <PinEntry
            label="Your 4-digit PIN"
            onSubmit={async (pin) => {
              const res = await umpireSignInAction(tournamentId, pin);
              if (res.error) return { error: res.error };
              setSignInOpen(false);
              store.resumeAfterAuth();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SyncPill({ state, onRetry, onSignIn }: { state: StoreState; onRetry: () => void; onSignIn: () => void }) {
  const n = state.pending.length;
  const base = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs";
  if (state.status === "auth") {
    return (
      <button type="button" onClick={onSignIn} className={cn(base, "border-brass/50 bg-brass/10 text-brass")}>
        <TriangleAlert className="size-3.5" />
        Sign in to sync
      </button>
    );
  }
  if (state.status === "conflict") {
    return (
      <span className={cn(base, "border-rust/50 bg-rust/10 text-[#e58a72]")}>
        <TriangleAlert className="size-3.5" />
        Not syncing
      </span>
    );
  }
  if (state.status === "offline" && n) {
    return (
      <button type="button" onClick={onRetry} className={cn(base, "border-brass/50 bg-brass/10 text-brass")}>
        <CloudOff className="size-3.5" />
        Offline · {n} saved on phone
      </button>
    );
  }
  if (n) {
    return (
      <span className={cn(base, "border-line text-muted-foreground")}>
        <Loader2 className="size-3.5 animate-spin" />
        Syncing {n}
      </span>
    );
  }
  return (
    <span className={cn(base, "border-line text-muted-foreground")}>
      <RefreshCw className="size-3 text-brass" />
      Saved
    </span>
  );
}

/** Doubles always shows two players, even if a name is missing. */
function fill(list: CourtPlayer[], doubles: boolean): CourtPlayer[] {
  const n = doubles ? 2 : 1;
  const out = list.slice(0, n);
  while (out.length < n) out.push({ name: `Player ${out.length + 1}`, avatarUrl: null });
  return out;
}
