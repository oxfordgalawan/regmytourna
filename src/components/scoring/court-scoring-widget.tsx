"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  finalizeMatchAction,
  incrementScoreAction,
  undoLastScoreAction,
} from "@/app/actions/scoring";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Match } from "@/types/database";
import { cn } from "@/lib/utils";

export function CourtScoringWidget({
  courtName,
  match,
  divisionName,
}: {
  courtName: string;
  match: Match;
  divisionName?: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [flash, setFlash] = useState<"a" | "b" | null>(null);
  const loading = busy || refreshing;

  async function run(action: () => Promise<unknown>, failMessage: string) {
    setBusy(true);
    try {
      await action();
      startRefresh(() => router.refresh());
    } catch {
      toast.error(failMessage);
    } finally {
      setBusy(false);
    }
  }

  function inc(side: "a" | "b") {
    if (navigator.vibrate) navigator.vibrate(15);
    setFlash(side);
    window.setTimeout(() => setFlash(null), 350);
    run(() => incrementScoreAction(match.id, side), "Point not saved — tap again.");
  }

  const sides = [
    { key: "a" as const, label: match.team_a_label, score: match.score_a, games: match.games_won_a },
    { key: "b" as const, label: match.team_b_label, score: match.score_b, games: match.games_won_b },
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-5 pb-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2 text-bone">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-rust" />
            {courtName}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Match {match.match_number ?? "—"}
            {divisionName ? ` · ${divisionName}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow">Game</p>
          <p className="display text-3xl text-bone">{match.current_game}</p>
        </div>
      </header>

      <div className="mt-5 grid flex-1 grid-rows-2 gap-3">
        {sides.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => inc(s.key)}
            disabled={loading}
            aria-label={`Point to ${s.label}. Current score ${s.score}.`}
            className={cn(
              "group relative flex select-none flex-col justify-between overflow-hidden rounded-3xl border p-5 text-left transition-all active:scale-[0.985] disabled:cursor-wait",
              s.key === "a" ? "border-umber bg-espresso" : "border-line bg-surface",
              flash === s.key && "border-bone bg-umber"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-lg font-semibold text-bone">{s.label}</span>
              <span className="flex gap-1" aria-label={`${s.games} games won`}>
                {Array.from({ length: Math.max(2, s.games) }).map((_, i) => (
                  <span key={i} className={cn("h-5 w-1.5 rounded-full", i < s.games ? "bg-brass" : "bg-line")} />
                ))}
              </span>
            </div>
            <span
              key={s.score}
              className="display text-[clamp(6rem,30vw,10rem)] leading-[0.8] text-bone tabular-nums animate-flip"
            >
              {s.score}
            </span>
            <span className="absolute right-5 bottom-5 rounded-full border border-bone/20 px-3 py-1 font-mono text-xs text-bone/70 transition-colors group-hover:border-bone/50">
              TAP +1
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={() => run(() => undoLastScoreAction(match.id), "Couldn't undo — try again.")}
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Undo2 />}
          Undo
        </Button>
        <Button size="lg" onClick={() => setConfirmOpen(true)} disabled={loading}>
          <Flag />
          End game
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              End game {match.current_game} at {match.score_a}–{match.score_b}?
            </DialogTitle>
            <DialogDescription>
              This records the game score. If the match is decided, the result is submitted to
              Challonge.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep playing
            </Button>
            <Button
              onClick={async () => {
                await run(() => finalizeMatchAction(match.id), "Couldn't record the result.");
                setConfirmOpen(false);
              }}
              disabled={loading}
            >
              {loading && <Loader2 className="animate-spin" />}
              Confirm result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
