"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleStop, Loader2, Play, ShieldCheck, Square, Timer } from "lucide-react";
import { toast } from "sonner";
import { logTimerAction } from "@/app/actions/officiating";
import { Button } from "@/components/ui/button";
import { TIMERS, timerLabel } from "@/lib/scoring/pickleball";
import { cn } from "@/lib/utils";

export type TimerEvent = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  operatorLabel: string | null;
  createdAt: string;
};

type Run = {
  seconds: number;
  startedAt: number;
  end: { kind: "finished" | "stopped"; at: number; elapsed?: number } | null;
  by: string | null;
};

/** Pairs each logged start with its finish/stop. */
export function timerRuns(events: TimerEvent[]): Run[] {
  const runs: Run[] = [];
  for (const e of events) {
    const seconds = Number(e.payload.seconds);
    if (e.kind === "timer_started") {
      runs.push({ seconds, startedAt: Date.parse(e.createdAt), end: null, by: e.operatorLabel });
    } else if (e.kind === "timer_finished" || e.kind === "timer_stopped") {
      const open = [...runs].reverse().find((r) => !r.end && r.seconds === seconds);
      if (open) {
        open.end = {
          kind: e.kind === "timer_finished" ? "finished" : "stopped",
          at: Date.parse(e.createdAt),
          elapsed: typeof e.payload.elapsed === "number" ? e.payload.elapsed : undefined,
        };
      }
    }
  }
  return runs;
}

/** wall-clock read, kept outside render */
const nowMs = () => Date.now();

const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", second: "2-digit" });

function mmss(total: number) {
  const s = Math.max(0, Math.ceil(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch {
    // sound is a nice-to-have
  }
}

/** 1 / 3 / 5 minute timers. Every start, finish and stop is saved to the match log. */
export function MatchTimers({ matchId, events, compact = false }: { matchId: string; events: TimerEvent[]; compact?: boolean }) {
  const router = useRouter();
  const runs = useMemo(() => timerRuns(events), [events]);
  // a timer left running (page reloaded mid-countdown) picks up where it was
  const [running, setRunning] = useState<{ seconds: number; startedAt: number } | null>(() => {
    const r = [...runs].reverse().find((x) => !x.end);
    return r && r.startedAt + r.seconds * 1000 > nowMs() - 2000 ? { seconds: r.seconds, startedAt: r.startedAt } : null;
  });
  const [now, setNow] = useState(nowMs);
  const [busy, setBusy] = useState<number | "stop" | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const finishing = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(nowMs()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  const left = running ? running.seconds - (now - running.startedAt) / 1000 : 0;

  useEffect(() => {
    if (!running || left > 0 || finishing.current) return;
    finishing.current = true;
    const finished = running;
    setRunning(null);
    setDone(finished.seconds);
    beep();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    logTimerAction(matchId, "finished", finished.seconds, finished.seconds).then((res) => {
      finishing.current = false;
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }, [left, running, matchId, router]);

  async function start(seconds: number) {
    if (busy !== null) return;
    setBusy(seconds);
    setDone(null);
    if (running) {
      const elapsed = (nowMs() - running.startedAt) / 1000;
      await logTimerAction(matchId, "stopped", running.seconds, elapsed);
    }
    const res = await logTimerAction(matchId, "started", seconds);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      setRunning(null);
      return;
    }
    const t = nowMs();
    setNow(t);
    setRunning({ seconds, startedAt: t });
    router.refresh();
  }

  async function stop() {
    if (!running || busy !== null) return;
    setBusy("stop");
    const elapsed = (nowMs() - running.startedAt) / 1000;
    const res = await logTimerAction(matchId, "stopped", running.seconds, elapsed);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    setRunning(null);
    router.refresh();
  }

  const progress = running ? Math.min(1, Math.max(0, 1 - left / running.seconds)) : 0;

  return (
    <div className="space-y-3">
      {running ? (
        <div className="relative overflow-hidden rounded-2xl border border-brass/40 bg-espresso p-4">
          <div className="absolute inset-y-0 left-0 bg-brass/10 transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
          <div className="relative flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-brass">{timerLabel(running.seconds)}</p>
              <p className={cn("display tabular-nums text-bone", compact ? "text-5xl" : "text-6xl", left <= 10 && "text-[#e58a72]")}>
                {mmss(left)}
              </p>
            </div>
            <Button variant="outline" size="lg" onClick={stop} disabled={busy !== null}>
              {busy === "stop" ? <Loader2 className="animate-spin" /> : <Square />}
              Stop
            </Button>
          </div>
        </div>
      ) : done ? (
        <div className="flex items-center gap-3 rounded-2xl border border-bone/30 bg-bone/[0.06] px-4 py-3">
          <CircleCheck className="size-5 shrink-0 text-bone" />
          <p className="text-sm text-bone">
            <span className="font-semibold">Time!</span> {timerLabel(done)} ({mmss(done)}) finished and logged.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        {TIMERS.map((t) => {
          const active = running?.seconds === t.seconds;
          return (
            <button
              key={t.seconds}
              type="button"
              disabled={busy !== null || active}
              onClick={() => start(t.seconds)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 text-center transition-colors disabled:opacity-60",
                active ? "border-brass bg-brass/10" : "border-line bg-surface hover:border-bone/40"
              )}
            >
              <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                {busy === t.seconds ? <Loader2 className="size-3 animate-spin" /> : active ? <Timer className="size-3" /> : <Play className="size-3" />}
                {t.short}
              </span>
              <span className="text-sm font-semibold leading-tight text-bone">{t.label}</span>
            </button>
          );
        })}
      </div>

      {!compact && <TimerLog runs={runs} />}
    </div>
  );
}

/** The proof: every timer run, when, and whether it ran to the end. */
export function TimerLog({ runs }: { runs: Run[] }) {
  if (!runs.length) {
    return <p className="text-xs text-muted-foreground">No timers run yet. Each timer you run is saved here.</p>;
  }
  return (
    <div className="rounded-xl border border-line">
      <p className="flex items-center gap-1.5 border-b border-line px-3 py-2 text-xs font-medium text-bone">
        <ShieldCheck className="size-3.5 text-brass" />
        Timer log · saved to the match record
      </p>
      <ul className="divide-y divide-line">
        {runs.map((r, i) => (
          <li key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
            {r.end?.kind === "finished" ? (
              <CircleCheck className="size-4 shrink-0 text-brass" />
            ) : r.end ? (
              <CircleStop className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <Timer className="size-4 shrink-0 text-bone" />
            )}
            <span className="min-w-0 flex-1">
              <span className="text-bone">
                {timerLabel(r.seconds)} · {mmss(r.seconds)}
              </span>
              <span className="block text-muted-foreground">
                {clock(r.startedAt)}
                {r.end
                  ? r.end.kind === "finished"
                    ? ` → ${clock(r.end.at)} · ran in full`
                    : ` → ${clock(r.end.at)} · stopped at ${mmss(r.end.elapsed ?? (r.end.at - r.startedAt) / 1000)}`
                  : " · running"}
                {r.by ? ` · ${r.by}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
