import { computeStandings, poolStandings, type EngineMatch, type StandingRow } from "@/lib/bracket-engine";
import type { DivisionContext } from "./server";

export type DrawView = {
  matches: EngineMatch[];
  pools: Array<{ letter: string; rows: StandingRow[] }> | null;
  table: StandingRow[] | null;
  advance: number;
  withdrawn: string[];
};

/** Props for <BracketView>, computed on the server from a category's context. */
export function buildDrawView(ctx: DivisionContext): DrawView {
  const everyone = ctx.allEntries.map(({ id, name }) => ({ id, name }));
  const pool = ctx.matches.filter((m) => m.stage === "pool");
  const flat = ctx.matches.filter((m) => m.stage === "round_robin" || m.stage === "swiss");

  let table: StandingRow[] | null = null;
  if (flat.length) {
    // only the teams actually in this stage (after pools, that's the advancers)
    const ids = new Set(flat.flatMap((m) => [m.a, m.b]).filter(Boolean) as string[]);
    table = computeStandings(
      everyone.filter((e) => ids.has(e.id)),
      flat,
      ctx.config.tiebreakers
    );
  }

  return {
    matches: ctx.matches,
    pools: pool.length
      ? [...poolStandings(ctx.config, everyone, pool).entries()].map(([letter, rows]) => ({ letter, rows }))
      : null,
    table,
    advance: ctx.config.pools?.advance ?? 0,
    withdrawn: [...ctx.withdrawn],
  };
}
