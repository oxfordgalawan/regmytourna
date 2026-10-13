import { nextPowerOfTwo, seedOrder } from "./seeding";
import { BYE, randomId, type EngineMatch, type Entry, type IdFactory, type Slot, type Stage } from "./types";

/** A first-round pairing; `null` is a bye (that side will never be filled). */
export type Side = Entry | null;
export type Pair = [Side, Side];

function blank(id: string, stage: Stage, round: number, position: number): EngineMatch {
  return {
    id,
    stage,
    pool: null,
    round,
    position,
    matchNumber: 0,
    roundLabel: "",
    a: null,
    b: null,
    aLabel: "TBD",
    bLabel: "TBD",
    nextMatchId: null,
    nextSlot: null,
    loserNextMatchId: null,
    loserNextSlot: null,
    isBye: false,
    isConditional: false,
    status: "scheduled",
    winner: null,
    gameScores: null,
  };
}

function fillSide(m: EngineMatch, slot: Slot, side: Side) {
  if (slot === "a") {
    m.a = side?.id ?? null;
    m.aLabel = side?.name ?? BYE;
  } else {
    m.b = side?.id ?? null;
    m.bLabel = side?.name ?? BYE;
  }
}

const link = (from: EngineMatch, to: EngineMatch, slot: Slot) => {
  from.nextMatchId = to.id;
  from.nextSlot = slot;
};
const linkLoser = (from: EngineMatch, to: EngineMatch, slot: Slot) => {
  from.loserNextMatchId = to.id;
  from.loserNextSlot = slot;
};

export function knockoutRoundName(matchesInRound: number) {
  if (matchesInRound === 1) return "Final";
  if (matchesInRound === 2) return "Semi-final";
  if (matchesInRound === 4) return "Quarter-final";
  return `Round of ${matchesInRound * 2}`;
}

/** Seeds entries into a power-of-two draw (1v8, 4v5 …); missing seeds become byes. */
export function seededPairs(entries: Entry[]): Pair[] {
  const size = Math.max(2, nextPowerOfTwo(entries.length));
  const order = seedOrder(size);
  const pairs: Pair[] = [];
  for (let i = 0; i < size; i += 2) {
    pairs.push([entries[order[i] - 1] ?? null, entries[order[i + 1] - 1] ?? null]);
  }
  return pairs;
}

/** Winners'-bracket tree: rounds[r][i] feeds rounds[r+1][floor(i/2)]. */
function buildTree(pairs: Pair[], stage: Stage, newId: IdFactory): EngineMatch[][] {
  const rounds: EngineMatch[][] = [];
  let count = pairs.length;
  for (let r = 1; count >= 1; r++, count /= 2) {
    rounds.push(Array.from({ length: count }, (_, i) => blank(newId(), stage, r, i)));
    if (count === 1) break;
  }
  pairs.forEach(([x, y], i) => {
    fillSide(rounds[0][i], "a", x);
    fillSide(rounds[0][i], "b", y);
  });
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].forEach((m, i) => link(m, rounds[r + 1][Math.floor(i / 2)], i % 2 === 0 ? "a" : "b"));
  }
  rounds.forEach((round) => round.forEach((m) => (m.roundLabel = knockoutRoundName(round.length))));
  return rounds;
}

/** Single knockout. `pairs.length` must be a power of two. */
export function buildSingleElimination(
  pairs: Pair[],
  opts: { thirdPlace: boolean; newId?: IdFactory }
): EngineMatch[] {
  const newId = opts.newId ?? randomId;
  const rounds = buildTree(pairs, "winners", newId);
  const all = rounds.flat();
  const entrants = pairs.flat().filter(Boolean).length;

  if (opts.thirdPlace && rounds.length >= 2 && entrants >= 4) {
    const semis = rounds[rounds.length - 2];
    const bronze = blank(newId(), "third_place", rounds.length, 1);
    bronze.roundLabel = "Bronze match";
    linkLoser(semis[0], bronze, "a");
    linkLoser(semis[1], bronze, "b");
    all.push(bronze);
  }
  return all;
}

/**
 * Double knockout. Losers' rounds alternate: odd rounds pair up survivors,
 * even rounds bring in the next winners'-round losers (order flipped every
 * other round so teams don't meet again straight away).
 */
export function buildDoubleElimination(
  pairs: Pair[],
  opts: { grandFinal: "reset" | "single" | "none"; newId?: IdFactory }
): EngineMatch[] {
  const newId = opts.newId ?? randomId;
  const wb = buildTree(pairs, "winners", newId);
  const k = wb.length; // winners' rounds; draw size = 2^k
  wb.forEach((round, r) =>
    round.forEach((m) => (m.roundLabel = r === k - 1 ? "Winners' final" : `Winners' R${r + 1}`))
  );

  const lb: EngineMatch[][] = [];
  if (k >= 2) {
    const size = pairs.length * 2;
    // round 1: losers of winners' R1, paired
    lb.push(Array.from({ length: size / 4 }, (_, i) => blank(newId(), "losers", 1, i)));
    wb[0].forEach((m, i) => linkLoser(m, lb[0][Math.floor(i / 2)], i % 2 === 0 ? "a" : "b"));

    for (let j = 1; j <= k - 1; j++) {
      // major round 2j: survivors vs losers dropping from winners' round j+1
      const prev = lb[lb.length - 1];
      const major = prev.map((_, i) => blank(newId(), "losers", lb.length + 1, i));
      prev.forEach((m, i) => link(m, major[i], "a"));
      const drops = wb[j];
      drops.forEach((m, i) => {
        const target = j % 2 === 1 ? major.length - 1 - i : i;
        linkLoser(m, major[target], "b");
      });
      lb.push(major);

      // minor round 2j+1: pair up the survivors (not after the last major round)
      if (j < k - 1) {
        const minor = Array.from({ length: major.length / 2 }, (_, i) => blank(newId(), "losers", lb.length + 1, i));
        major.forEach((m, i) => link(m, minor[Math.floor(i / 2)], i % 2 === 0 ? "a" : "b"));
        lb.push(minor);
      }
    }
    lb.forEach((round, r) =>
      round.forEach((m) => (m.roundLabel = r === lb.length - 1 ? "Losers' final" : `Losers' R${r + 1}`))
    );
  }

  const all = [...wb.flat(), ...lb.flat()];
  const wbFinal = wb[k - 1][0];
  const lbFinal = lb.length ? lb[lb.length - 1][0] : null;

  if (opts.grandFinal !== "none") {
    const gf = blank(newId(), "grand_final", k + 1, 0);
    gf.roundLabel = "Grand final";
    link(wbFinal, gf, "a");
    if (lbFinal) link(lbFinal, gf, "b");
    else linkLoser(wbFinal, gf, "b"); // 2-team draw: the loser gets their second life here
    all.push(gf);

    if (opts.grandFinal === "reset") {
      const reset = blank(newId(), "grand_final_reset", k + 2, 0);
      reset.roundLabel = "Grand final · decider";
      reset.isConditional = true;
      reset.aLabel = "If needed";
      reset.bLabel = "If needed";
      all.push(reset);
    }
  }
  return all;
}
