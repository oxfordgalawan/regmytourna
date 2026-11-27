"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { formatPhp } from "@/lib/format";
import type { IncomeByEvent } from "@/lib/wallet/overview";
import { cn } from "@/lib/utils";

export function IncomeByEventAccordion({
  events,
  settlementDisplay,
  topNetCents,
}: {
  events: IncomeByEvent[];
  settlementDisplay: boolean;
  topNetCents: number;
}) {
  if (!events.length) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        When players pay for your events, each event shows up here with what it earned.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {events.map((e, i) => (
        <li key={e.tournamentId}>
          <details className="group overflow-hidden rounded-xl border border-line/80 bg-espresso/30">
            <summary
              className={cn(
                "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
                "px-4 py-3"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  <div className="min-w-0">
                    <Link
                      href={`/tournaments/${e.slug}`}
                      onClick={(ev) => ev.stopPropagation()}
                      className="block truncate text-sm font-medium text-bone hover:text-brass"
                    >
                      {e.name}
                    </Link>
                    <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
                      {e.entries} paid {e.entries === 1 ? "entry" : "entries"} · {formatPhp(e.grossCents)}{" "}
                      collected · {formatPhp(e.feeCents)} fees
                    </p>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-sm text-bone">{formatPhp(e.netCents)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/60">
                <div
                  className="h-full origin-left rounded-full bg-gradient-to-r from-umber to-brass motion-safe:animate-[grow_900ms_cubic-bezier(.2,.8,.2,1)_both]"
                  style={{
                    width: `${Math.max(3, (Math.max(0, e.netCents) / topNetCents) * 100)}%`,
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              </div>
            </summary>

            <div className="space-y-4 border-t border-line/60 px-4 py-3">
              {e.categories.length === 0 ? (
                <p className="text-xs text-muted-foreground">No entry breakdown yet.</p>
              ) : (
                e.categories.map((cat) => (
                  <div key={cat.categoryId ?? cat.categoryName}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-brass/90">
                        {cat.categoryName}
                      </p>
                      <span className="font-mono text-xs text-bone">{formatPhp(cat.netCents)}</span>
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {cat.lines.map((line) => {
                        const removed = line.status === "removed_refunded";
                        return (
                          <li
                            key={line.id}
                            className={cn(
                              "flex items-baseline justify-between gap-3 rounded-lg px-2.5 py-1.5",
                              removed ? "bg-ink/20 opacity-80" : "bg-ink/40"
                            )}
                          >
                            <span className="min-w-0">
                              <span
                                className={cn(
                                  "block truncate text-xs",
                                  removed ? "text-muted-foreground line-through" : "text-bone"
                                )}
                              >
                                {line.label}
                              </span>
                              {removed ? (
                                <span className="mt-0.5 block text-[0.6rem] font-medium text-[#e58a72]">
                                  Removed · manually refunded
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 text-right">
                              {removed ? (
                                <span className="font-mono text-xs text-muted-foreground">—</span>
                              ) : (
                                <>
                                  <span className="font-mono text-xs text-bone">
                                    {settlementDisplay && line.settlementCents !== null
                                      ? formatPhp(line.settlementCents)
                                      : formatPhp(line.netCents)}
                                  </span>
                                  {line.grossCents > 0 && (
                                    <span className="mt-0.5 block font-mono text-[0.6rem] text-muted-foreground">
                                      {formatPhp(line.grossCents)} collected
                                    </span>
                                  )}
                                </>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}