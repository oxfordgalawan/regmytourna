"use client";

import { useState } from "react";
import { DrawMatchCard } from "@/components/draw/draw-match-card";
import { PoolStandingsTable } from "@/components/draw/pool-standings-table";
import type { EngineMatch, StandingRow } from "@/lib/bracket-engine";
import { cn } from "@/lib/utils";

type Tab = "standings" | "matches";

export function PoolGroupPanel({
  letter,
  rows,
  matches,
  advance = 0,
  withdrawn,
  onOpenMatch,
  playedCount,
  totalCount,
  gamesToWin = 1,
}: {
  letter: string;
  rows: StandingRow[];
  matches: EngineMatch[];
  advance?: number;
  withdrawn?: Set<string>;
  onOpenMatch?: (m: EngineMatch) => void;
  playedCount: number;
  totalCount: number;
  gamesToWin?: number;
}) {
  const [tab, setTab] = useState<Tab>("standings");
  const sorted = [...matches].sort((a, b) => a.matchNumber - b.matchNumber);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="display text-2xl text-bone">Group {letter}</p>
        <div className="flex items-center gap-3">
          {advance > 0 && (
            <p className="font-mono text-[0.65rem] text-muted-foreground">Top {advance} go through</p>
          )}
          <div
            role="tablist"
            aria-label={`Group ${letter}`}
            className="inline-flex rounded-lg border border-line bg-ink/40 p-0.5"
          >
            {(
              [
                ["standings", "Standings"],
                ["matches", "Matches"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  tab === id ? "bg-bone text-ink" : "text-muted-foreground hover:text-bone"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "standings" ? (
        <PoolStandingsTable rows={rows} poolMatches={matches} advance={advance} withdrawn={withdrawn} />
      ) : (
        <div className="p-4">
          <p className="mb-3 font-mono text-[0.65rem] text-muted-foreground">
            {playedCount}/{totalCount} played
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sorted.map((m) => (
              <DrawMatchCard key={m.id} m={m} onOpen={onOpenMatch} compact gamesToWin={gamesToWin} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
