"use client";

import { ViewTransition } from "react";
import { ArrowRight, Medal, Trophy } from "lucide-react";
import { summarize, type BracketConfig } from "@/lib/bracket-format";
import { cn } from "@/lib/utils";

const POOL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_BOXES = 8;

/** Standard bracket seeding: 1v8, 4v5, 2v7, 3v6 for an 8-draw, recursively. */
function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2 + 1;
    order = order.flatMap((s) => [s, n - s]);
  }
  return order;
}

function roundName(matchesInRound: number) {
  if (matchesInRound === 1) return "Final";
  if (matchesInRound === 2) return "Semis";
  if (matchesInRound === 4) return "Quarters";
  return `Round of ${matchesInRound * 2}`;
}

/** First-round labels: cross-pool pairings when 2 advance, else seed numbers. */
function firstRoundLabels(config: BracketConfig, advancing: number, size: number): [string, string][] {
  const pools = config.pools;
  const poolCount = pools ? Math.ceil(advancing / pools.advance) : 0;
  if (pools && pools.advance === 2 && poolCount % 2 === 0 && poolCount * 2 === size) {
    // A1 v B2, B1 v A2, C1 v D2, D1 v C2 …
    const pairs: [string, string][] = [];
    for (let g = 0; g < poolCount; g += 2) {
      const a = POOL_LETTERS[g];
      const b = POOL_LETTERS[g + 1];
      pairs.push([`${a}1`, `${b}2`], [`${b}1`, `${a}2`]);
    }
    return pairs;
  }
  const order = seedOrder(size);
  const pairs: [string, string][] = [];
  for (let i = 0; i < order.length; i += 2) {
    const label = (seed: number) => (seed > advancing ? "Bye" : `#${seed}`);
    pairs.push([label(order[i]), label(order[i + 1])]);
  }
  return pairs;
}

function MatchBox({ top, bottom, highlight }: { top?: string; bottom?: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "w-24 overflow-hidden rounded-md border text-[0.65rem] font-mono",
        highlight ? "border-brass bg-umber/40" : "border-line bg-ink/60"
      )}
    >
      <div className={cn("truncate border-b border-line px-2 py-1", top === "Bye" ? "text-muted-foreground/50" : "text-bone/80")}>
        {top ?? " "}
      </div>
      <div className={cn("truncate px-2 py-1", bottom === "Bye" ? "text-muted-foreground/50" : "text-bone/80")}>
        {bottom ?? " "}
      </div>
    </div>
  );
}

function Column({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex shrink-0 flex-col", className)}>
      <p className="eyebrow mb-3 whitespace-nowrap">{title}</p>
      <div className="flex flex-1 flex-col justify-around gap-2">{children}</div>
    </div>
  );
}

function More({ count }: { count: number }) {
  return count > 0 ? (
    <p className="font-mono text-[0.65rem] text-muted-foreground">+{count} more</p>
  ) : null;
}

/**
 * Live, schematic picture of a format for a given team count. Purely visual —
 * the real draw is generated on Challonge once players are synced.
 */
export function BracketPreview({
  config,
  teams,
  className,
}: {
  config: BracketConfig;
  teams: number;
  className?: string;
}) {
  const s = summarize(config, teams);
  const f = config.final;
  const isKnockout = f.type === "single_elimination" || f.type === "double_elimination";

  // knockout rounds: matches per round, halving to the final
  const rounds: number[] = [];
  if (isKnockout && s.knockoutSize >= 2) {
    for (let m = s.knockoutSize / 2; m >= 1; m /= 2) rounds.push(m);
  }
  const firstPairs = isKnockout && s.knockoutSize >= 2 ? firstRoundLabels(config, s.advancing, s.knockoutSize) : [];

  return (
    <ViewTransition default="vt-fade">
      <div
        className={cn(
          "court-grid relative overflow-hidden rounded-2xl border border-line bg-surface",
          className
        )}
      >
        <div className="flex items-stretch gap-6 overflow-x-auto p-5 scrollbar-none">
          {s.pools && (
            <>
              <Column title={`${s.pools.length} pools`}>
                <div className="grid grid-cols-2 gap-2">
                  {s.pools.slice(0, MAX_BOXES).map((size, i) => (
                    <div key={i} className="w-24 rounded-md border border-umber bg-espresso p-2">
                      <p className="display text-lg text-bone">Pool {POOL_LETTERS[i]}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Array.from({ length: size }).map((_, seat) => (
                          <span
                            key={seat}
                            className={cn(
                              "size-2.5 rounded-full",
                              seat < (config.pools?.advance ?? 0) ? "bg-brass" : "bg-line"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <More count={s.pools.length - MAX_BOXES} />
              </Column>
              <div className="flex shrink-0 flex-col items-center justify-center gap-1 text-muted-foreground">
                <ArrowRight className="size-4" />
                <span className="font-mono text-[0.6rem] whitespace-nowrap">top {config.pools?.advance}</span>
              </div>
            </>
          )}

          {isKnockout &&
            rounds.map((matches, r) => {
              const shown = Math.min(matches, MAX_BOXES);
              return (
                <Column key={r} title={roundName(matches)}>
                  {Array.from({ length: shown }).map((_, i) => (
                    <MatchBox
                      key={i}
                      top={r === 0 ? firstPairs[i]?.[0] : undefined}
                      bottom={r === 0 ? firstPairs[i]?.[1] : undefined}
                      highlight={matches === 1}
                    />
                  ))}
                  <More count={matches - shown} />
                </Column>
              );
            })}

          {isKnockout && (
            <Column title="Podium">
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 text-xs text-bone">
                  <Trophy className="size-4 text-brass" /> Champion
                </span>
                {f.type === "single_elimination" && f.thirdPlaceMatch && s.advancing >= 4 && (
                  <span className="flex items-center gap-2 text-xs text-bone/70">
                    <Medal className="size-4" /> Bronze match
                  </span>
                )}
                {f.type === "double_elimination" && (
                  <span className="max-w-32 text-xs text-muted-foreground">
                    + losers&apos; bracket ({Math.max(0, s.advancing - 2)} matches)
                    {f.grandFinal === "reset" && ", grand final can reset"}
                  </span>
                )}
              </div>
            </Column>
          )}

          {f.type === "round_robin" && (
            <Column title={`${s.advancing} teams · everyone plays everyone`}>
              <div
                className="grid gap-0.5"
                style={{ gridTemplateColumns: `repeat(${Math.min(s.advancing, 10)}, 0.75rem)` }}
              >
                {Array.from({ length: Math.min(s.advancing, 10) ** 2 }).map((_, i) => {
                  const n = Math.min(s.advancing, 10);
                  const row = Math.floor(i / n);
                  const col = i % n;
                  return (
                    <span
                      key={i}
                      className={cn(
                        "size-3 rounded-[2px]",
                        row === col ? "bg-transparent" : row < col ? "bg-brass/70" : "bg-umber"
                      )}
                    />
                  );
                })}
              </div>
            </Column>
          )}

          {f.type === "swiss" && (
            <>
              {Array.from({ length: Math.min(f.rounds, 6) }).map((_, r) => (
                <Column key={r} title={`Round ${r + 1}`}>
                  {Array.from({ length: Math.min(Math.floor(s.advancing / 2), 4) }).map((_, i) => (
                    <MatchBox key={i} />
                  ))}
                  <More count={Math.floor(s.advancing / 2) - 4} />
                </Column>
              ))}
              <More count={f.rounds - 6} />
            </>
          )}
        </div>
      </div>
    </ViewTransition>
  );
}
