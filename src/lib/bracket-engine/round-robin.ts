import { randomId, type EngineMatch, type Entry, type IdFactory } from "./types";

/**
 * Circle-method schedule: every entry meets every other once per iteration,
 * spread over rounds so nobody plays twice in a round.
 */
export function roundRobinPairs(entries: Entry[], iterations: 1 | 2 = 1): Array<Array<[Entry, Entry]>> {
  const list: (Entry | null)[] = [...entries];
  if (list.length % 2) list.push(null); // odd count: one entry rests each round
  const n = list.length;
  const rounds: Array<Array<[Entry, Entry]>> = [];

  for (let iter = 0; iter < iterations; iter++) {
    const rot = [...list];
    for (let r = 0; r < n - 1; r++) {
      const pairs: Array<[Entry, Entry]> = [];
      for (let i = 0; i < n / 2; i++) {
        const x = rot[i];
        const y = rot[n - 1 - i];
        if (x && y) {
          // alternate sides so nobody is always "team A"; flip again on the second pass
          const flip = (r + i + iter) % 2 === 1;
          pairs.push(flip ? [y, x] : [x, y]);
        }
      }
      rounds.push(pairs);
      // keep the first fixed, rotate the rest clockwise
      rot.splice(1, 0, rot.pop()!);
    }
  }
  return rounds;
}

/** Round-robin matches for one pool (stage "pool") or a whole category ("round_robin"). */
export function roundRobinMatches(
  entries: Entry[],
  opts: { stage: "pool" | "round_robin"; pool?: string; iterations?: 1 | 2; newId?: IdFactory }
): EngineMatch[] {
  const newId = opts.newId ?? randomId;
  const matches: EngineMatch[] = [];
  roundRobinPairs(entries, opts.iterations ?? 1).forEach((pairs, r) => {
    pairs.forEach(([x, y], position) => {
      matches.push({
        id: newId(),
        stage: opts.stage,
        pool: opts.pool ?? null,
        round: r + 1,
        position,
        matchNumber: 0,
        roundLabel: opts.pool ? `Pool ${opts.pool} · Round ${r + 1}` : `Round ${r + 1}`,
        a: x.id,
        b: y.id,
        aLabel: x.name,
        bLabel: y.name,
        nextMatchId: null,
        nextSlot: null,
        loserNextMatchId: null,
        loserNextSlot: null,
        isBye: false,
        isConditional: false,
        status: "scheduled",
        winner: null,
        gameScores: null,
      });
    });
  });
  return matches;
}
