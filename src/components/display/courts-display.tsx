import { AutoRefresh } from "@/components/display/auto-refresh";
import type { QueueData, QueueMatch } from "@/lib/queue/load";
import { cn } from "@/lib/utils";

/** Venue TV board: one column per court — live match with score, then that court's queue. */
export function CourtsDisplay({ name, data }: { name: string; data: QueueData }) {
  const { courts, liveElsewhere, ready } = data;
  const cols = Math.min(Math.max(courts.length, 1), 4);

  return (
    <div className="grain relative flex min-h-screen flex-col bg-ink text-bone">
      <header className="flex items-end justify-between gap-8 border-b border-umber px-10 py-6">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2 text-bone/80">
            <span className="size-2 animate-pulse-dot rounded-full bg-rust" />
            Live courts
          </p>
          <h1 className="display mt-2 truncate text-6xl">{name}</h1>
        </div>
        <AutoRefresh seconds={10} />
      </header>

      {courts.length === 0 ? (
        <p className="display flex-1 py-32 text-center text-5xl text-bone/40">Courts will appear here</p>
      ) : (
        <main
          className="grid flex-1 content-start gap-5 p-8"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {courts.map((c) => {
            const live = c.live[0] ?? null;
            return (
              <section key={c.id} className="flex min-w-0 flex-col gap-4">
                {/* court header */}
                <div className="flex items-center justify-between gap-3 px-1">
                  <h2 className="display truncate text-5xl">{c.name}</h2>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-full px-3 py-1 font-mono text-sm tracking-widest uppercase",
                      live ? "bg-rust/20 text-[#f0a48f]" : "bg-brass/15 text-brass"
                    )}
                  >
                    <span className={cn("size-2 rounded-full", live ? "animate-pulse-dot bg-rust" : "bg-brass")} />
                    {live ? "Playing" : "Free"}
                  </span>
                </div>

                {/* on court */}
                {live ? (
                  <LiveCard m={live} />
                ) : (
                  <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-3xl border border-dashed border-line px-6 text-center">
                    <p className="display text-4xl text-bone/40">Court free</p>
                    {c.queued[0] && <p className="mt-2 text-lg text-bone/60">Next match can start</p>}
                  </div>
                )}

                {/* queue */}
                <div className="rounded-3xl border border-line bg-surface/70">
                  <p className="eyebrow border-b border-line px-5 py-3 text-bone/70">
                    Up next{c.queued.length ? ` · ${c.queued.length}` : ""}
                  </p>
                  {!c.queued.length ? (
                    <p className="px-5 py-5 text-lg text-bone/40">No matches queued</p>
                  ) : (
                    <ol className="divide-y divide-line">
                      {c.queued.slice(0, 5).map((m, i) => (
                        <li key={m.id} className={cn("flex gap-4 px-5 py-3.5", i === 0 && "bg-brass/[0.07]")}>
                          <span
                            className={cn(
                              "w-14 shrink-0 pt-1 font-mono text-sm tracking-widest",
                              i === 0 ? "text-brass" : "text-bone/40"
                            )}
                          >
                            {i === 0 ? "NEXT" : `#${i + 1}`}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-xl", i === 0 ? "text-bone" : "text-bone/80")}>{m.teamA}</p>
                            <p className={cn("truncate text-xl", i === 0 ? "text-bone" : "text-bone/80")}>
                              <span className="mr-2 font-mono text-sm text-bone/40">vs</span>
                              {m.teamB}
                            </p>
                            <p className="mt-0.5 truncate text-sm text-bone/50">{m.divisionName}</p>
                          </div>
                        </li>
                      ))}
                      {c.queued.length > 5 && (
                        <li className="px-5 py-3 text-sm text-bone/50">+{c.queued.length - 5} more in line</li>
                      )}
                    </ol>
                  )}
                </div>
              </section>
            );
          })}
        </main>
      )}

      {(liveElsewhere.length > 0 || ready.length > 0) && (
        <footer className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-umber px-10 py-4 text-lg text-bone/60">
          {liveElsewhere.length > 0 && (
            <span>
              <span className="text-bone">{liveElsewhere.length}</span> more live{" "}
              {liveElsewhere.length === 1 ? "match" : "matches"}
            </span>
          )}
          {ready.length > 0 && (
            <span>
              <span className="text-bone">{ready.length}</span> {ready.length === 1 ? "match" : "matches"} waiting for a
              court
            </span>
          )}
        </footer>
      )}
    </div>
  );
}

function LiveCard({ m }: { m: QueueMatch }) {
  const sides = [
    { name: m.teamA, score: m.scoreA, games: m.gamesA, lead: m.scoreA > m.scoreB },
    { name: m.teamB, score: m.scoreB, games: m.gamesB, lead: m.scoreB > m.scoreA },
  ];
  const showGames = m.gamesA + m.gamesB > 0;
  return (
    <article className="overflow-hidden rounded-3xl border border-bone/40 bg-espresso">
      <p className="truncate border-b border-line px-6 py-3 text-base text-bone/60">
        {m.divisionName}
        {m.label && <span className="font-mono"> · {m.label}</span>}
      </p>
      {sides.map((s, i) => (
        <div key={i} className={cn("flex items-center justify-between gap-4 px-6 py-4", i === 0 && "border-b border-line")}>
          <span className={cn("min-w-0 truncate text-2xl font-medium", s.lead ? "text-bone" : "text-bone/60")}>{s.name}</span>
          <span className="flex shrink-0 items-baseline gap-3">
            {showGames && <span className="font-mono text-lg text-brass">{s.games}</span>}
            <span className={cn("display text-7xl tabular-nums", s.lead ? "text-bone" : "text-bone/45")}>{s.score}</span>
          </span>
        </div>
      ))}
      {m.umpireName && <p className="px-6 py-2.5 text-sm text-bone/50">Umpire: {m.umpireName}</p>}
    </article>
  );
}
