import type { Entry } from "./types";

/** Standard bracket order for a power-of-two draw: 1v8, 4v5, 2v7, 3v6 … (1-based seeds). */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2 + 1;
    order = order.flatMap((s) => [s, n - s]);
  }
  return order;
}

export const nextPowerOfTwo = (n: number) => 2 ** Math.max(0, Math.ceil(Math.log2(Math.max(1, n))));

/**
 * Deals seeded entries into pools in a snake (A B C D D C B A …) so the top
 * seeds are spread evenly. `sizes` comes from `poolSizes()`; bigger pools first.
 */
export function snakePools(entries: Entry[], sizes: number[]): Entry[][] {
  const pools: Entry[][] = sizes.map(() => []);
  let i = 0;
  let forward = true;
  for (const entry of entries) {
    // skip pools that are already full (sizes can differ by one)
    let guard = 0;
    while (pools[i].length >= sizes[i] && guard++ < sizes.length * 2) {
      ({ i, forward } = step(i, forward, sizes.length));
    }
    pools[i].push(entry);
    ({ i, forward } = step(i, forward, sizes.length));
  }
  return pools;
}

function step(i: number, forward: boolean, count: number) {
  if (count === 1) return { i: 0, forward };
  if (forward) return i === count - 1 ? { i, forward: false } : { i: i + 1, forward };
  return i === 0 ? { i, forward: true } : { i: i - 1, forward };
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const POOL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
