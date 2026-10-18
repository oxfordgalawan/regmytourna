import { TIEBREAKER_LABELS } from "@/lib/bracket-format";
import { poolMatchHistoryEntries, type EngineMatch, type StandingRow } from "@/lib/bracket-engine";
import { cn } from "@/lib/utils";

/** Challonge-style pool standings: W-L-T, set wins, total points, match history. */
export function PoolStandingsTable({
  rows,
  poolMatches,
  advance = 0,
  withdrawn,
}: {
  rows: StandingRow[];
  poolMatches: EngineMatch[];
  advance?: number;
  withdrawn?: Set<string>;
}) {
  return (
    <div className="overflow-x-auto scrollbar-none">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left font-mono text-[0.65rem] tracking-wider text-muted-foreground uppercase">
            <th className="py-2 pr-2 pl-4 font-normal">Rank</th>
            <th className="py-2 pr-3 font-normal">Participant</th>
            <th className="px-2 py-2 text-center font-normal" title="Match wins–losses–ties">
              W-L-T
            </th>
            <th className="px-2 py-2 text-center font-normal" title="Games won in matches">
              Set wins
            </th>
            <th className="px-2 py-2 text-center font-normal" title="Total rally points scored">
              Pts
            </th>
            <th className="py-2 pr-4 pl-2 font-normal">Match history</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const through = r.rank <= advance && !withdrawn?.has(r.id);
            const out = withdrawn?.has(r.id);
            const history = poolMatchHistoryEntries(r.id, poolMatches);
            return (
              <tr key={r.id} className={cn("border-t border-line transition-colors", through && "bg-umber/25")}>
                <td className="py-2.5 pr-2 pl-4 font-mono text-xs text-muted-foreground">
                  <span className={cn(through && "text-brass")}>{r.rank}</span>
                </td>
                <td className="max-w-40 py-2.5 pr-3">
                  <span className={cn("block truncate text-bone", out && "text-muted-foreground line-through")}>
                    {r.name}
                  </span>
                  {r.decidedBy && r.decidedBy !== "seed" && (
                    <span className="block font-mono text-[0.6rem] text-brass/80">
                      tie broken by {TIEBREAKER_LABELS[r.decidedBy].label.toLowerCase()}
                    </span>
                  )}
                  {out && <span className="block font-mono text-[0.6rem] text-muted-foreground">withdrawn</span>}
                </td>
                <td className="px-2 py-2.5 text-center font-mono text-bone">
                  {r.wins} - {r.losses} - 0
                </td>
                <td className="px-2 py-2.5 text-center font-mono text-bone/80">{r.gamesFor}</td>
                <td className="px-2 py-2.5 text-center font-mono text-bone/80">{r.pointsFor}</td>
                <td className="py-2.5 pr-4 pl-2">
                  <div className="flex max-w-md flex-wrap gap-1">
                    {history.map((h, i) => (
                      <span
                        key={i}
                        title={h.tooltip}
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded font-mono text-[0.65rem] font-semibold",
                          h.outcome === "W" ? "bg-brass/25 text-brass" : "bg-rust/20 text-rust"
                        )}
                      >
                        {h.outcome}
                      </span>
                    ))}
                    {!history.length && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
