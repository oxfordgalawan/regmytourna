"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Flag, Loader2, Timer, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { rallyAction } from "@/app/actions/officiating";
import { finalizeMatchAction, undoLastScoreAction } from "@/app/actions/scoring";
import { GameSetup } from "@/components/scoring/game-setup";
import { MatchTimers, TimerLog, timerRuns, type TimerEvent } from "@/components/scoring/match-timers";
import { PickleballBoard } from "@/components/scoring/pickleball-board";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isServeState, other, rally, type MatchSetup, type ServeState, type Side } from "@/lib/scoring/pickleball";
import type { CourtPlayer } from "@/lib/scoring/officiating";
import type { Match } from "@/types/database";
import { NAV_BACK } from "@/lib/nav-transitions";

type Local = { basedOn: string; state: ServeState; scores: { a: number; b: number }; call: string };

export function PickleballScoring({
  match,
  courtName,
  divisionName,
  backHref,
  doubles,
  players,
  events,
}: {
  match: Match & { serve_state?: unknown; match_setup?: MatchSetup | null };
  courtName: string;
  divisionName?: string;
  backHref: string;
  doubles: boolean;
  players: { a: CourtPlayer[]; b: CourtPlayer[] };
  events: TimerEvent[];
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<Local | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [timersOpen, setTimersOpen] = useState(false);

  const serverState = isServeState(match.serve_state) && match.serve_state.game === match.current_game ? match.serve_state : null;
  const signature = `${match.current_game}:${match.score_a}:${match.score_b}:${JSON.stringify(serverState)}`;
  // an optimistic result is shown until the refreshed match arrives
  const view = local && local.basedOn === signature ? local : null;
  const state = view?.state ?? serverState;
  const scores = view?.scores ?? { a: match.score_a, b: match.score_b };
  const loading = busy || refreshing;

  const teams = {
    a: { side: "a" as const, label: match.team_a_label, players: fill(players.a, doubles), games: match.games_won_a },
    b: { side: "b" as const, label: match.team_b_label, players: fill(players.b, doubles), games: match.games_won_b },
  };

  function refresh() {
    startRefresh(() => router.refresh());
  }

  async function point(winner: Side) {
    if (!state || loading) return;
    if (navigator.vibrate) navigator.vibrate(15);
    const predicted = rally(state, scores, winner);
    const call = predicted.kind === "point" ? "Point" : predicted.kind === "side_out" ? "Side out" : "Second server";
    setLocal({ basedOn: signature, state: predicted.state, scores: predicted.scores, call });
    setBusy(true);
    const res = await rallyAction(match.id, winner);
    setBusy(false);
    if (!res.ok) {
      setLocal(null);
      toast.error(res.error);
    }
    refresh();
  }

  async function undo() {
    if (loading) return;
    setBusy(true);
    setLocal(null);
    try {
      await undoLastScoreAction(match.id);
    } catch {
      toast.error("Couldn't undo — try again.");
    }
    setBusy(false);
    refresh();
  }

  async function endGame() {
    setBusy(true);
    try {
      const res = await finalizeMatchAction(match.id);
      if (res && "error" in res && res.error) toast.error(res.error);
      else setEndOpen(false);
    } catch {
      toast.error("Couldn't record the result.");
    }
    setBusy(false);
    setLocal(null);
    refresh();
  }

  const servingTeam = state ? teams[state.serving] : null;
  const faultResult = state ? (state.doubles && state.server === 1 ? "2nd server" : "Side out") : "";

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <Link
        href={backHref}
        transitionTypes={NAV_BACK}
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-bone"
      >
        <ArrowLeft className="size-4" />
        All matches
      </Link>
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
          <p className="display text-3xl text-bone">{match.current_game}</p>
        </div>
      </header>

      {match.status === "completed" ? (
        <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-3xl border border-umber bg-espresso p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-bone text-ink">
            <Check className="size-6" strokeWidth={3} />
          </span>
          <p className="display mt-5 text-4xl text-bone">Match finished</p>
          <p className="mt-2 text-sm text-muted-foreground">Games won</p>
          <div className="mt-3 grid w-full max-w-xs grid-cols-2 gap-3">
            {[teams.a, teams.b].map((t) => (
              <div key={t.side} className="rounded-xl border border-line bg-surface p-3">
                <p className="truncate text-sm text-bone/80">{t.label}</p>
                <p className="display text-5xl text-bone">{t.games}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 w-full max-w-sm text-left">
            <TimerLog runs={timerRuns(events)} />
          </div>
          <Button asChild size="lg" className="mt-8">
            <Link href={backHref} transitionTypes={NAV_BACK}>
              Next match
            </Link>
          </Button>
        </div>
      ) : !state ? (
        <GameSetup
          key={match.current_game}
          matchId={match.id}
          game={match.current_game}
          doubles={doubles}
          teams={[
            { side: "a", label: teams.a.label, players: teams.a.players },
            { side: "b", label: teams.b.label, players: teams.b.players },
          ]}
          setup={match.match_setup ?? null}
          events={events}
          onStarted={refresh}
        />
      ) : (
        <div className="mt-4 flex flex-1 flex-col gap-3">
          <PickleballBoard
            state={state}
            scores={scores}
            teams={teams}
            base={match.match_setup?.base ?? null}
            lastCall={view?.call ?? null}
          />

          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" className="h-16 flex-col gap-0 text-base" disabled={loading} onClick={() => point(state.serving)}>
              Point
              <span className="max-w-full truncate text-xs font-normal opacity-70">{servingTeam?.label}</span>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-16 flex-col gap-0 border-rust/50 text-base"
              disabled={loading}
              onClick={() => point(other(state.serving))}
            >
              Fault
              <span className="text-xs font-normal text-muted-foreground">{faultResult}</span>
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={undo} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Undo2 />}
              Undo
            </Button>
            <Button variant="outline" onClick={() => setTimersOpen(true)}>
              <Timer />
              Timer
            </Button>
            <Button variant="umber" onClick={() => setEndOpen(true)} disabled={loading}>
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
            <DialogDescription>Each run is saved to the match record.</DialogDescription>
          </DialogHeader>
          <MatchTimers matchId={match.id} events={events} />
        </DialogContent>
      </Dialog>

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              End game {match.current_game} at {scores.a}–{scores.b}?
            </DialogTitle>
            <DialogDescription>
              {teams.a.label} {scores.a} · {teams.b.label} {scores.b}. This records the game score; if the match is
              decided, the result is posted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndOpen(false)}>
              Keep playing
            </Button>
            <Button onClick={endGame} disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Confirm result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Doubles always shows two players, even if a name is missing. */
function fill(list: CourtPlayer[], doubles: boolean): CourtPlayer[] {
  const n = doubles ? 2 : 1;
  const out = list.slice(0, n);
  while (out.length < n) out.push({ name: `Player ${out.length + 1}`, avatarUrl: null });
  return out;
}
