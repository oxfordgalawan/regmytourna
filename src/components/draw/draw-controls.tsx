"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, Play, RotateCcw, Share2, SkipForward } from "lucide-react";
import { toast } from "@/lib/ui/app-toast";
import {
  closePoolsAction,
  exportToChallongeAction,
  nextSwissRoundAction,
  regenerateKnockoutFromPoolsAction,
  resetBracketAction,
  startBracketAction,
} from "@/app/actions/draw";
import type { PoolKnockoutPreview } from "@/lib/bracket-engine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DrawControlsProps = {
  divisionId: string;
  divisionName: string;
  state: string;
  hasPools: boolean;
  finalLabel: string;
  isSwiss: boolean;
  swissRound: number;
  swissRounds: number;
  swissRoundDone: boolean;
  entries: number;
  challongeUrl: string | null;
  poolKnockoutPreview: PoolKnockoutPreview | null;
  canRegenerateKnockout: boolean;
};

export function DrawControls(p: DrawControlsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const steps = [
    { key: "not_started", label: "Seeding" },
    ...(p.hasPools ? [{ key: "pools", label: "Pools" }] : []),
    { key: "final", label: p.finalLabel },
    { key: "complete", label: "Done" },
  ];
  const stateIndex = (() => {
    if (p.state === "pools_done") return steps.findIndex((s) => s.key === "pools");
    const i = steps.findIndex((s) => s.key === p.state);
    return i < 0 ? 0 : i;
  })();

  async function run(key: string, action: () => Promise<{ error?: string }>, success: string) {
    setBusy(key);
    const res = await action();
    setBusy(null);
    if (res.error) {
      toast.error(res.error);
      return false;
    }
    toast.success(success);
    router.refresh();
    return true;
  }

  async function closePools() {
    setBusy("close");
    const res = await closePoolsAction(p.divisionId);
    setBusy(null);
    if (res.pending) {
      if (!window.confirm(`${res.error} Close the pools anyway? Unplayed matches won't count.`)) return;
      await run("close", () => closePoolsAction(p.divisionId, true), "Knockout drawn");
      return;
    }
    if (res.error) return toast.error(res.error);
    toast.success("Knockout drawn");
    router.refresh();
  }

  async function reset() {
    if (!window.confirm("Delete this draw and go back to seeding?")) return;
    setBusy("reset");
    let res = await resetBracketAction(p.divisionId);
    if (res.needsConfirm) {
      const typed = window.prompt(`Matches have been played. Type "${p.divisionName}" to delete the draw anyway.`);
      res = typed ? await resetBracketAction(p.divisionId, typed) : { error: "Reset cancelled" };
    }
    setBusy(null);
    if (res.error) return toast.error(res.error);
    toast.success("Draw reset");
    router.refresh();
  }

  async function exportChallonge() {
    setBusy("export");
    const res = await exportToChallongeAction(p.divisionId);
    setBusy(null);
    if (res.error) return toast.error(res.error);
    toast.success("Copied to Challonge");
    // refresh first: opening the new tab hides this one, and a refresh in a
    // hidden tab aborts its view transition
    router.refresh();
    if (res.url) window.open(res.url, "_blank", "noopener");
  }

  const primary = (() => {
    switch (p.state) {
      case "not_started":
        return (
          <Button
            size="lg"
            disabled={busy !== null || p.entries < 2}
            onClick={() => {
              if (window.confirm("Start the bracket? The seeding locks and matches are created.")) {
                run("start", () => startBracketAction(p.divisionId), "Bracket started");
              }
            }}
          >
            {busy === "start" ? <Loader2 className="animate-spin" /> : <Play />}
            Start bracket
          </Button>
        );
      case "pools":
      case "pools_done":
        return (
          <Button size="lg" variant={p.state === "pools_done" ? "default" : "outline"} disabled={busy !== null} onClick={closePools}>
            {busy === "close" ? <Loader2 className="animate-spin" /> : <SkipForward />}
            Close pools & start {p.finalLabel.toLowerCase()}
          </Button>
        );
      case "final":
        return p.isSwiss && p.swissRound < p.swissRounds ? (
          <Button
            size="lg"
            disabled={busy !== null || !p.swissRoundDone}
            title={p.swissRoundDone ? undefined : "Finish the current round first"}
            onClick={() => run("swiss", () => nextSwissRoundAction(p.divisionId), `Round ${p.swissRound + 1} drawn`)}
          >
            {busy === "swiss" ? <Loader2 className="animate-spin" /> : <SkipForward />}
            Start round {p.swissRound + 1} of {p.swissRounds}
          </Button>
        ) : null;
      case "complete":
        return (
          <span className="inline-flex items-center gap-2 rounded-full bg-bone px-4 py-2 text-sm font-medium text-ink">
            <Check className="size-4" strokeWidth={3} />
            Category complete
          </span>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
      <ol className="flex items-center gap-2 overflow-x-auto scrollbar-none" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s.key} className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full font-mono text-[0.65rem] transition-colors",
                i < stateIndex || p.state === "complete"
                  ? "bg-bone text-ink"
                  : i === stateIndex
                    ? "border border-brass text-brass"
                    : "border border-line text-muted-foreground"
              )}
            >
              {i < stateIndex || p.state === "complete" ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("text-sm", i === stateIndex ? "text-bone" : "text-muted-foreground")}>{s.label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-line" />}
          </li>
        ))}
      </ol>

      {p.poolKnockoutPreview && p.poolKnockoutPreview.pairs.length > 0 && (
        <div className="rounded-xl border border-line bg-ink/40 px-4 py-3 text-sm">
          <p className="font-medium text-bone">
            {p.poolKnockoutPreview.mode === "challonge_cross"
              ? "Planned first-round pairings (Challonge cross-seed)"
              : "Planned first-round pairings (ranked seeding)"}
          </p>
          {p.poolKnockoutPreview.reason && (
            <p className="mt-1 text-muted-foreground">{p.poolKnockoutPreview.reason}</p>
          )}
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {p.poolKnockoutPreview.pairs.map((pair, i) => (
              <li key={i}>
                {pair.aName} vs {pair.bName}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {primary}
          {p.state === "not_started" && p.entries < 2 && (
            <span className="text-sm text-muted-foreground">Needs at least 2 confirmed entries.</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {p.challongeUrl ? (
            <Button size="sm" variant="ghost" asChild>
              <a href={p.challongeUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Open on Challonge
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={exportChallonge} disabled={busy !== null || p.entries < 1}>
              {busy === "export" ? <Loader2 className="animate-spin" /> : <Share2 />}
              Export to Challonge
            </Button>
          )}
          {p.canRegenerateKnockout && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy !== null}
              onClick={() => {
                if (
                  window.confirm(
                    "Replace the knockout bracket with pairings from the current pool standings? No knockout match may have been played yet."
                  )
                ) {
                  run("rebuild-ko", () => regenerateKnockoutFromPoolsAction(p.divisionId), "Knockout rebuilt");
                }
              }}
            >
              {busy === "rebuild-ko" ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Rebuild knockout from pools
            </Button>
          )}
          {p.state !== "not_started" && (
            <Button size="sm" variant="ghost" onClick={reset} disabled={busy !== null}>
              {busy === "reset" ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Reset draw
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
