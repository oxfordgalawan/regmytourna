"use client";

import { useEffect, useState } from "react";
import { AutoRefresh } from "@/components/display/auto-refresh";
import { cn } from "@/lib/utils";

type TvPayload = {
  title: string | null;
  teamALabel: string;
  teamBLabel: string;
  status: string;
  scoreA: number;
  scoreB: number;
  gamesWonA: number;
  gamesWonB: number;
  currentGame: number;
};

export function QuickScoreTv({ token }: { token: string }) {
  const [data, setData] = useState<TvPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/quick-score/${token}`, { cache: "no-store" });
        const json = (await res.json()) as TvPayload & { error?: string; code?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Could not load scoreboard.");
          setData(null);
          return;
        }
        setError(null);
        setData(json);
      } catch {
        if (!cancelled) setError("Connection lost. Retrying…");
      }
    }

    void load();
    const id = window.setInterval(() => void load(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [token]);

  if (error && !data) {
    return (
      <div className="grain flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink px-8 text-center text-bone">
        <p className="display text-5xl sm:text-6xl">{error}</p>
        <AutoRefresh seconds={5} clock={false} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grain flex min-h-dvh items-center justify-center bg-ink text-bone">
        <p className="eyebrow animate-pulse">Loading live score…</p>
      </div>
    );
  }

  const done = data.status === "completed";
  const showGames = data.gamesWonA + data.gamesWonB > 0;
  const sides = [
    { name: data.teamALabel, score: data.scoreA, games: data.gamesWonA, lead: data.scoreA > data.scoreB },
    { name: data.teamBLabel, score: data.scoreB, games: data.gamesWonB, lead: data.scoreB > data.scoreA },
  ];

  return (
    <div className="grain relative flex min-h-dvh flex-col bg-ink text-bone">
      <header className="flex items-end justify-between gap-8 border-b border-umber px-8 py-6 sm:px-10">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2 text-bone/80">
            {!done && <span className="size-2 animate-pulse-dot rounded-full bg-rust" />}
            {done ? "Final" : "Live score"}
          </p>
          <h1 className="display mt-2 truncate text-5xl sm:text-6xl">{data.title ?? "Pickleball"}</h1>
          {!done && (
            <p className="mt-2 font-mono text-sm text-bone/50">Game {data.currentGame}</p>
          )}
        </div>
        <AutoRefresh seconds={3} />
      </header>

      <main className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12">
        <article className="overflow-hidden rounded-3xl border border-bone/40 bg-espresso">
          {sides.map((s, i) => (
            <div
              key={i}
              className={cn("flex items-center justify-between gap-6 px-8 py-8 sm:px-12 sm:py-10", i === 0 && "border-b border-line")}
            >
              <span className={cn("min-w-0 truncate text-3xl font-medium sm:text-4xl", s.lead ? "text-bone" : "text-bone/60")}>
                {s.name}
              </span>
              <span className="flex shrink-0 items-baseline gap-4">
                {showGames && <span className="font-mono text-2xl text-brass sm:text-3xl">{s.games}</span>}
                <span className={cn("display text-8xl tabular-nums sm:text-9xl", s.lead ? "text-bone" : "text-bone/45")}>
                  {s.score}
                </span>
              </span>
            </div>
          ))}
        </article>
      </main>
    </div>
  );
}