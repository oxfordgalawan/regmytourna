import { seededPairs } from "./elimination";
import type { Pair } from "./elimination";
import type { Entry } from "./types";

type Side = Entry | null;
type PoolAdvancers = [Side, Side]; // [winner, runner-up]

const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;

/**
 * First-round knockout pairings when exactly two advance per pool (Challonge-style).
 * Each tuple is [winnerGroupIndex, runnerUpGroupIndex]; pair order matches bracket layout.
 */
function challongeAdvanceTwoPairings(groupCount: number): Array<[number, number]> {
  switch (groupCount) {
    case 2:
      return [
        [0, 1],
        [1, 0],
      ];
    case 4:
      return [
        [0, 3],
        [2, 1],
        [1, 2],
        [3, 0],
      ];
    case 8:
      return [
        [0, 1],
        [2, 3],
        [4, 5],
        [6, 7],
        [1, 0],
        [3, 2],
        [5, 4],
        [7, 6],
      ];
    default: {
      if (!isPowerOfTwo(groupCount) || groupCount < 16) return [];
      const out: Array<[number, number]> = [];
      for (let g = 0; g < groupCount; g += 2) {
        out.push([g, g + 1], [g + 1, g]);
      }
      return out;
    }
  }
}

/** Seed index (0-based) for each group's winner and runner-up in a power-of-two draw. */
function winnerSeedIndex(groupCount: number, groupIndex: number): number {
  switch (groupCount) {
    case 2:
      return groupIndex;
    case 4:
      return [0, 1, 3, 2][groupIndex]!;
    default:
      return groupIndex;
  }
}

function runnerSeedIndex(groupCount: number, groupIndex: number): number {
  switch (groupCount) {
    case 2:
      return groupCount + groupIndex;
    case 4:
      return groupCount + [1, 0, 2, 3][groupIndex]!;
    default:
      return groupCount + groupIndex;
  }
}

/**
 * Builds seed lines 1…2G for `seededPairs` (index i = seed i+1).
 * Used when tests need seed-order verification; pairings come from {@link challongePoolKnockoutPairs}.
 */
export function buildChallongeAdvanceTwoSeedList(pools: PoolAdvancers[]): Entry[] {
  const g = pools.length;
  if (!isPowerOfTwo(g) || g < 2) return [];
  const slots: (Entry | undefined)[] = new Array(2 * g);
  for (let i = 0; i < g; i++) {
    const [winner, runner] = pools[i]!;
    const wi = winnerSeedIndex(g, i);
    const ri = runnerSeedIndex(g, i);
    if (winner) slots[wi] = winner;
    if (runner) slots[ri] = runner;
  }
  return slots.map((e) => e ?? (undefined as unknown as Entry));
}

/** First-round pairs for pool→knockout (Challonge cross-seeding). */
export function challongePoolKnockoutPairs(pools: PoolAdvancers[]): Pair[] {
  const g = pools.length;
  const spec = challongeAdvanceTwoPairings(g);
  if (!spec.length) return seededPairs(buildChallongeAdvanceTwoSeedList(pools));

  const w = (gi: number) => pools[gi]?.[0] ?? null;
  const r = (gj: number) => pools[gj]?.[1] ?? null;
  return spec.map(([gi, gj]) => [w(gi), r(gj)]);
}

export function challongeAdvanceTwoSupported(groupCount: number): boolean {
  return isPowerOfTwo(groupCount) && groupCount >= 2;
}
