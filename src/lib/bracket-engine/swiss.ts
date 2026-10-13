import type { Tiebreaker } from "../bracket-format";
import { computeStandings } from "./standings";
import { BYE, randomId, type EngineMatch, type Entry, type IdFactory } from "./types";

function swissMatch(newId: IdFactory, round: number, position: number, x: Entry, y: Entry | null): EngineMatch {
  return {
    id: newId(),
    stage: "swiss",
    pool: null,
    round,
    position,
    matchNumber: 0,
    roundLabel: `Round ${round}`,
    a: x.id,
    b: y?.id ?? null,
    aLabel: x.name,
    bLabel: y?.name ?? BYE,
    nextMatchId: null,
    nextSlot: null,
    loserNextMatchId: null,
    loserNextSlot: null,
    isBye: !y,
    isConditional: false,
    status: y ? "scheduled" : "completed",
    winner: y ? null : x.id,
    gameScores: null,
  };
}

/** Pairs a ranked list top-down, avoiding rematches; falls back to a rematch only if unavoidable. */
function pairUp(ranked: Entry[], played: Set<string>): Array<[Entry, Entry]> {
  const key = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  // backtracking can explode on awkward fields; give up on "no rematches" after a budget
  let budget = 20_000;
  const solve = (rest: Entry[], allowRematch: boolean): Array<[Entry, Entry]> | null => {
    if (!rest.length) return [];
    if (!allowRematch && --budget < 0) return null;
    const [first, ...others] = rest;
    for (let i = 0; i < others.length; i++) {
      if (!allowRematch && played.has(key(first.id, others[i].id))) continue;
      const tail = solve([...others.slice(0, i), ...others.slice(i + 1)], allowRematch);
      if (tail) return [[first, others[i]], ...tail];
    }
    return null;
  };
  return solve(ranked, false) ?? solve(ranked, true)!;
}

/**
 * Next Swiss round. Round 1 pairs the top half against the bottom half by
 * seed; later rounds pair teams on similar records. With an odd field the
 * lowest-ranked team without a bye sits out (counted as a win).
 */
export function swissRound(
  entries: Entry[],
  previous: EngineMatch[],
  round: number,
  tiebreakers: Tiebreaker[],
  newId: IdFactory = randomId
): EngineMatch[] {
  const ranked =
    round === 1
      ? entries
      : computeStandings(entries, previous, tiebreakers).map((r) => entries.find((e) => e.id === r.id)!);

  const matches: EngineMatch[] = [];
  let pool = ranked;
  if (pool.length % 2) {
    const hadBye = new Set(previous.filter((m) => m.isBye && m.winner).map((m) => m.winner!));
    const byeTo = [...pool].reverse().find((e) => !hadBye.has(e.id)) ?? pool[pool.length - 1];
    pool = pool.filter((e) => e.id !== byeTo.id);
    matches.push(swissMatch(newId, round, pool.length / 2, byeTo, null));
  }

  let pairs: Array<[Entry, Entry]>;
  if (round === 1) {
    const half = pool.length / 2;
    pairs = Array.from({ length: half }, (_, i) => [pool[i], pool[i + half]] as [Entry, Entry]);
  } else {
    const played = new Set(
      previous
        .filter((m) => m.a && m.b)
        .map((m) => (m.a! < m.b! ? `${m.a}|${m.b}` : `${m.b}|${m.a}`))
    );
    pairs = pairUp(pool, played);
  }
  pairs.forEach(([x, y], i) => matches.unshift(swissMatch(newId, round, i, x, y)));
  return matches.sort((x, y) => x.position - y.position);
}
