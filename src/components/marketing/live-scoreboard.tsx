"use client";

import { useEffect, useReducer } from "react";
import { cn } from "@/lib/utils";

type Rally = { a: number; b: number; serving: "a" | "b" };

const TEAMS = { a: ["Dela Cruz", "Santos"], b: ["Reyes", "Villanueva"] };

/** Self-playing pickleball scoreboard used as the hero visual. Purely decorative. */
type Board = Rally & { games: { a: number; b: number }; lastPoint: "a" | "b" | null };

function playRally(s: Board, serverWins: boolean): Board {
  const other = s.serving === "a" ? "b" : "a";
  // side-out: serve passes over, no point scored
  if (!serverWins) return { ...s, serving: other, lastPoint: null };
  const points = s[s.serving] + 1;
  if (points >= 11 && points - s[other] >= 2) {
    const games = { ...s.games, [s.serving]: (s.games[s.serving] + 1) % 3 };
    return { a: 0, b: 0, serving: other, games, lastPoint: s.serving };
  }
  return { ...s, [s.serving]: points, lastPoint: s.serving };
}

/** Self-playing pickleball scoreboard used as the hero visual. Purely decorative. */
export function LiveScoreboard({ className }: { className?: string }) {
  const [board, dispatch] = useReducer(playRally, {
    a: 7,
    b: 5,
    serving: "a",
    games: { a: 1, b: 0 },
    lastPoint: null,
  });
  const score = board;
  const { games, lastPoint } = board;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // the serving side wins the rally ~60% of the time
    const id = window.setInterval(() => dispatch(Math.random() < 0.6), 2200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        "grain relative overflow-hidden rounded-3xl border border-umber bg-espresso shadow-[0_40px_120px_-40px_rgb(69_48_26/0.9)]",
        className
      )}
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="size-2 animate-pulse-dot rounded-full bg-rust" />
          <span className="eyebrow text-bone">Live · Court 3</span>
        </div>
        <span className="eyebrow">Men&apos;s Doubles 4.0 · SF</span>
      </div>

      <div className="divide-y divide-line">
        {(["a", "b"] as const).map((side) => (
          <div
            key={side}
            className={cn(
              "grid grid-cols-[1fr_auto_auto] items-center gap-5 px-6 py-5 transition-colors duration-500",
              lastPoint === side && "bg-umber/40"
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full transition-colors",
                    score.serving === side ? "bg-bone" : "bg-transparent ring-1 ring-line"
                  )}
                />
                <span className="truncate text-base font-medium text-bone">
                  {TEAMS[side][0]}
                </span>
              </div>
              <p className="mt-0.5 truncate pl-4 text-sm text-muted-foreground">
                {TEAMS[side][1]}
              </p>
            </div>
            <div className="flex gap-1">
              {[0, 1].map((g) => (
                <span
                  key={g}
                  className={cn(
                    "h-6 w-1.5 rounded-full",
                    g < games[side] ? "bg-brass" : "bg-line"
                  )}
                />
              ))}
            </div>
            <span
              key={score[side]}
              className="display w-20 text-right text-7xl tabular-nums text-bone animate-flip [perspective:400px]"
            >
              {score[side].toString().padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 border-t border-line font-mono text-[0.6875rem] text-muted-foreground">
        <div className="border-r border-line px-6 py-3">
          GAME <span className="text-bone">{games.a + games.b + 1}</span> / 3
        </div>
        <div className="border-r border-line px-6 py-3">
          TO <span className="text-bone">11</span>, WIN BY 2
        </div>
        <div className="px-6 py-3 text-right">
          SYNC <span className="text-bone">CHALLONGE</span>
        </div>
      </div>
    </div>
  );
}
