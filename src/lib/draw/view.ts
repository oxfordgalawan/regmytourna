import {
  computeStandings,
  orderedPoolKeys,
  poolStandings,
  previewPoolKnockout,
  type EngineMatch,
  type PoolKnockoutPreview,
  type StandingRow,
} from "@/lib/bracket-engine";
import type { DivisionContext } from "./server";

export type DrawView = {
  matches: EngineMatch[];
  pools: Array<{ letter: string; groupNumber: number; rows: StandingRow[] }> | null;
  table: StandingRow[] | null;
  advance: number;
  withdrawn: string[];
  poolKnockoutPreview: PoolKnockoutPreview | null;
  canRegenerateKnockout: boolean;
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

  const standingsMap = pool.length ? poolStandings(ctx.config, everyone, pool) : null;
  const poolOrder = standingsMap ? orderedPoolKeys(standingsMap, ctx.config, pool) : [];
  const standingsForKo = standingsMap
    ? new Map(
        [...standingsMap.entries()].map(([k, rows]) => [k, rows.filter((r) => !ctx.withdrawn.has(r.id))])
      )
    : null;

  const state = ctx.division.bracket_state;
  const showPreview = Boolean(standingsForKo && ["pools", "pools_done"].includes(state));
  const ko = ctx.matches.filter((m) => m.stage !== "pool");
  const canRegenerateKnockout =
    state === "final" &&
    Boolean(ctx.config.pools) &&
    !ko.some(
      (m) =>
        !m.isBye &&
        (m.status === "completed" ||
          m.status === "in_progress" ||
          m.status === "walkover" ||
          (m.scoreA ?? 0) > 0 ||
          (m.scoreB ?? 0) > 0)
    );

  return {
    matches: ctx.matches,
    pools: standingsMap
      ? poolOrder.map((letter, i) => ({ letter, groupNumber: i + 1, rows: standingsMap.get(letter)! }))
      : null,
    table,
    advance: ctx.config.pools?.advance ?? 0,
    withdrawn: [...ctx.withdrawn],
    poolKnockoutPreview:
      showPreview && standingsForKo
        ? previewPoolKnockout(ctx.config, standingsForKo, ctx.entries, { poolOrder, poolMatches: pool })
        : null,
    canRegenerateKnockout,
  };
}
