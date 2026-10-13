import { TIEBREAKER_LABELS } from "@/lib/bracket-format";
import type { StandingRow } from "@/lib/bracket-engine";
import { cn } from "@/lib/utils";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Pool / round-robin / Swiss table. Rows above `advance` are highlighted as going through. */
export function StandingsTable({
  title,
  rows,
  advance = 0,
  withdrawn,
  className,
}: {
  title?: string;
  rows: StandingRow[];
  advance?: number;
  withdrawn?: Set<string>;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="display text-2xl text-bone">{title}</p>
          {advance > 0 && <p className="font-mono text-[0.65rem] text-muted-foreground">Top {advance} go through</p>}
        </div>
      )}
      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[0.65rem] tracking-wider text-muted-foreground uppercase">
              <th className="py-2 pr-2 pl-4 font-normal">#</th>
              <th className="py-2 pr-2 font-normal">Team</th>
              <th className="px-2 py-2 text-center font-normal" title="Played">P</th>
              <th className="px-2 py-2 text-center font-normal" title="Won–Lost">W–L</th>
              <th className="px-2 py-2 text-center font-normal" title="Game difference">G±</th>
              <th className="py-2 pr-4 pl-2 text-right font-normal" title="Point difference">Pts±</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const through = r.rank <= advance && !withdrawn?.has(r.id);
              const out = withdrawn?.has(r.id);
              return (
                <tr
                  key={r.id}
                  className={cn("border-t border-line transition-colors", through && "bg-umber/25")}
                >
                  <td className="py-2.5 pr-2 pl-4 font-mono text-xs text-muted-foreground">
                    <span className={cn(through && "text-brass")}>{r.rank}</span>
                  </td>
                  <td className="max-w-48 py-2.5 pr-2">
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
                  <td className="px-2 py-2.5 text-center font-mono text-bone/80">{r.played}</td>
                  <td className="px-2 py-2.5 text-center font-mono text-bone">
                    {r.wins}–{r.losses}
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono text-bone/80">{signed(r.gamesFor - r.gamesAgainst)}</td>
                  <td className="py-2.5 pr-4 pl-2 text-right font-mono text-bone/80">
                    {signed(r.pointsFor - r.pointsAgainst)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
