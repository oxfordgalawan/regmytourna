import { poolSizes, type BracketConfig } from "../bracket-format";
import { settle } from "./advance";
import {
  challongeAdvanceTwoSupported,
  challongePoolKnockoutPairs,
} from "./challonge-pool-knockout";
import { buildDoubleElimination, buildSingleElimination, seededPairs, type Pair } from "./elimination";
import {
  entriesFromKnockoutSlots,
  poolGroupsToEntryPools,
  usesKnockoutSlotSeeding,
  usesMultiPool,
} from "./layout";
import { roundRobinMatches } from "./round-robin";
import { POOL_LETTERS, snakePools } from "./seeding";
import { computeStandings, type StandingRow } from "./standings";
import { swissRound } from "./swiss";
import { BYE, randomId, type EngineMatch, type Entry, type IdFactory } from "./types";

export * from "./types";
export { applyResult, resolvePending, revertResult, settle, stageDone } from "./advance";
export {
  computeStandings,
  poolMatchHistory,
  poolMatchHistoryEntries,
  type PoolMatchHistoryEntry,
  type StandingRow,
} from "./standings";
export { seedOrder, shuffle, snakePools, POOL_LETTERS } from "./seeding";
export { seededPairs } from "./elimination";
export {
  challongeAdvanceTwoSupported,
  challongePoolKnockoutPairs,
} from "./challonge-pool-knockout";
export * from "./layout";

function poolLetterSort(a: string, b: string): number {
  const ia = POOL_LETTERS.indexOf(a);
  const ib = POOL_LETTERS.indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.localeCompare(b);
}

/**
 * Canonical group order for Challonge cross-seeding: seeding column order first,
 * then POOL_LETTERS order (not localeCompare on arbitrary labels).
 */
export function orderedPoolKeys(
  standings: Map<string, StandingRow[]>,
  config?: BracketConfig,
  poolMatches?: EngineMatch[]
): string[] {
  const keys = [...standings.keys()];
  const groups = config?.seedingLayout?.poolGroups;
  if (groups?.length && poolMatches?.length) {
    const order: string[] = [];
    const used = new Set<string>();
    for (const group of groups) {
      const ids = new Set(group.entryIds);
      const letter = poolMatches.find(
        (m) =>
          m.stage === "pool" &&
          m.pool &&
          !used.has(m.pool) &&
          ((m.a && ids.has(m.a)) || (m.b && ids.has(m.b)))
      )?.pool;
      if (letter && standings.has(letter)) {
        order.push(letter);
        used.add(letter);
      }
    }
    for (const k of keys.sort(poolLetterSort)) {
      if (!used.has(k)) order.push(k);
    }
    return order;
  }
  return keys.sort(poolLetterSort);
}

export type PoolKnockoutPreviewPair = { a: string; b: string; aName: string; bName: string };

export type PoolKnockoutPreview = {
  pairs: PoolKnockoutPreviewPair[];
  mode: "challonge_cross" | "ranked_seeding";
  reason?: string;
};

/** Planned first-round knockout pairs from current pool standings (organizer preview). */
export function previewPoolKnockout(
  config: BracketConfig,
  standings: Map<string, StandingRow[]>,
  entries: Entry[],
  opts?: { poolOrder?: string[]; poolMatches?: EngineMatch[] }
): PoolKnockoutPreview {
  const advance = config.pools?.advance ?? 2;
  const order = opts?.poolOrder ?? orderedPoolKeys(standings, config, opts?.poolMatches);
  const pools = order.filter((k) => standings.has(k)).map((k) => standings.get(k)!.slice(0, advance));
  const byId = new Map(entries.map((e) => [e.id, e.name]));
  const name = (id: string | null | undefined) => (id ? (byId.get(id) ?? id) : "TBD");

  const isBracket = config.final.type === "single_elimination" || config.final.type === "double_elimination";
  if (isBracket && advance === 2 && challongeAdvanceTwoSupported(pools.length)) {
    const entry = (r: StandingRow | undefined) =>
      r ? (byId.has(r.id) ? { id: r.id, name: byId.get(r.id)! } : { id: r.id, name: r.name }) : null;
    const pairs = challongePoolKnockoutPairs(
      pools.map((rows) => [entry(rows[0]), entry(rows[1])])
    );
    return {
      mode: "challonge_cross",
      pairs: pairs.map(([a, b]) => ({
        a: a?.id ?? "",
        b: b?.id ?? "",
        aName: name(a?.id),
        bName: name(b?.id),
      })),
    };
  }

  let reason: string | undefined;
  if (!isBracket) reason = "Final stage is not single or double elimination.";
  else if (advance !== 2) reason = "Challonge cross-seeding uses 2 advancers per group.";
  else if (!challongeAdvanceTwoSupported(pools.length)) {
    reason = `Challonge cross-seeding applies to 2, 4, or 8 groups (this draw has ${pools.length}).`;
  }

  const byPlace: Entry[] = [];
  for (let place = 0; place < advance; place++) {
    const atPlace = pools
      .map((rows) => rows[place])
      .filter(Boolean)
      .sort(
        (x, y) =>
          y.wins - x.wins ||
          y.gamesFor - y.gamesAgainst - (x.gamesFor - x.gamesAgainst) ||
          y.pointsFor - y.pointsAgainst - (x.pointsFor - x.pointsAgainst)
      );
    byPlace.push(...atPlace.map((r) => ({ id: r!.id, name: r!.name })));
  }
  const pairs = seededPairs(byPlace);
  return {
    mode: "ranked_seeding",
    reason,
    pairs: pairs.map(([a, b]) => ({
      a: a?.id ?? "",
      b: b?.id ?? "",
      aName: name(a?.id),
      bName: name(b?.id),
    })),
  };
}

/** Rough play order so match numbers read naturally: earlier rounds first. */
function playOrder(m: EngineMatch, finalRound: number): number {
  switch (m.stage) {
    case "winners":
      return 2 * m.round - 1;
    case "losers":
      return m.round + 1;
    case "third_place":
      return 2 * finalRound - 1.5;
    case "grand_final":
      return 10_000;
    case "grand_final_reset":
      return 10_001;
    default:
      return m.round;
  }
}

const STAGE_RANK: Record<string, number> = { winners: 0, losers: 1 };

/** Numbers matches from `startAt` and writes "Winner of M7" / "Loser of M7" placeholders. */
function numberAndLabel(matches: EngineMatch[], startAt: number) {
  const finalRound = Math.max(0, ...matches.filter((m) => m.stage === "winners").map((m) => m.round));
  const ordered = [...matches].sort(
    (x, y) =>
      playOrder(x, finalRound) - playOrder(y, finalRound) ||
      (STAGE_RANK[x.stage] ?? 2) - (STAGE_RANK[y.stage] ?? 2) ||
      (x.pool ?? "").localeCompare(y.pool ?? "") ||
      x.position - y.position
  );
  ordered.forEach((m, i) => (m.matchNumber = startAt + i));

  const byId = new Map(matches.map((m) => [m.id, m]));
  for (const m of matches) {
    const setLabel = (targetId: string | null, slot: "a" | "b" | null, label: string) => {
      const t = targetId ? byId.get(targetId) : undefined;
      if (!t || !slot) return;
      if (slot === "a" && !t.a && t.aLabel !== BYE) t.aLabel = label;
      if (slot === "b" && !t.b && t.bLabel !== BYE) t.bLabel = label;
    };
    setLabel(m.nextMatchId, m.nextSlot, `Winner of M${m.matchNumber}`);
    setLabel(m.loserNextMatchId, m.loserNextSlot, `Loser of M${m.matchNumber}`);
  }
  return ordered;
}

function namesOf(entries: Entry[]) {
  return new Map(entries.map((e) => [e.id, e.name]));
}

function bracketFrom(config: BracketConfig, pairs: Pair[], newId: IdFactory) {
  return config.final.type === "double_elimination"
    ? buildDoubleElimination(pairs, { grandFinal: config.final.grandFinal, newId })
    : buildSingleElimination(pairs, { thirdPlace: config.final.thirdPlaceMatch, newId });
}

/** Final-stage matches for a list of entries already in seed order. */
function finalStage(
  config: BracketConfig,
  entries: Entry[],
  newId: IdFactory,
  pairs?: Pair[]
): EngineMatch[] {
  switch (config.final.type) {
    case "single_elimination":
    case "double_elimination":
      return bracketFrom(config, pairs ?? seededPairs(entries), newId);
    case "round_robin":
      return roundRobinMatches(entries, { stage: "round_robin", iterations: config.final.playEachOther, newId });
    case "swiss":
      return swissRound(entries, [], 1, config.tiebreakers, newId);
  }
}

export type GeneratedStage = {
  matches: EngineMatch[];
  /** division state after this stage is created */
  state: "pools" | "final";
};

/** First stage of a category: pools if configured, otherwise the whole format. */
export function generateFirstStage(
  config: BracketConfig,
  entries: Entry[],
  opts: { newId?: IdFactory; withdrawn?: Set<string> } = {}
): GeneratedStage {
  if (entries.length < 2) throw new Error("A category needs at least 2 entries to start.");
  const newId = opts.newId ?? randomId;

  let matches: EngineMatch[];
  let state: GeneratedStage["state"];
  if (config.pools && entries.length > config.pools.size) {
    const manual =
      config.seedingLayout?.mode === "manual" && config.seedingLayout.poolGroups?.length
        ? poolGroupsToEntryPools(config.seedingLayout.poolGroups, entries)
        : null;
    const pools =
      manual ??
      snakePools(entries, poolSizes(entries.length, config.pools.size));
    matches = pools.flatMap((members, i) =>
      roundRobinMatches(members, {
        stage: "pool",
        pool: POOL_LETTERS[i],
        iterations: config.pools!.playEachOther,
        newId,
      })
    );
    state = "pools";
  } else {
    // a pools format with only one pool's worth of teams is just a round robin
    matches = config.pools
      ? roundRobinMatches(entries, { stage: "round_robin", iterations: config.pools.playEachOther, newId })
      : finalStage(
          config,
          entries,
          newId,
          usesKnockoutSlotSeeding(config, entries.length) &&
            config.seedingLayout?.mode === "manual" &&
            config.seedingLayout.knockoutSlots?.length
            ? seededPairs(entriesFromKnockoutSlots(config.seedingLayout.knockoutSlots, entries))
            : undefined
        );
    state = "final";
  }

  numberAndLabel(matches, 1);
  return { matches: settle(matches, { names: namesOf(entries), withdrawn: opts.withdrawn }), state };
}

export type PoolColumnLayout = { pool: string; entryIds: string[] };

/** Rebuild pool-stage matches from organizer pool columns (letters preserved). */
export function buildPoolStageMatches(
  config: BracketConfig,
  columns: PoolColumnLayout[],
  entries: Entry[],
  opts: { newId?: IdFactory; withdrawn?: Set<string> } = {}
): EngineMatch[] {
  if (!config.pools) throw new Error("This category has no pool stage.");
  const byId = new Map(entries.map((e) => [e.id, e]));
  const newId = opts.newId ?? randomId;
  let matches = columns.flatMap(({ pool, entryIds }) => {
    const members = entryIds.map((id) => byId.get(id)).filter((e): e is Entry => Boolean(e));
    if (members.length < 2) return [];
    return roundRobinMatches(members, {
      stage: "pool",
      pool,
      iterations: config.pools!.playEachOther,
      newId,
    });
  });
  numberAndLabel(matches, 1);
  return settle(matches, { names: namesOf(entries), withdrawn: opts.withdrawn });
}

/** Pool membership as stored on matches (pool letter → entries in seed order). */
export function poolsFromMatches(entries: Entry[], matches: EngineMatch[]): Map<string, Entry[]> {
  const pools = new Map<string, Entry[]>();
  const byId = new Map(entries.map((e) => [e.id, e]));
  for (const m of matches) {
    if (m.stage !== "pool" || !m.pool) continue;
    const list = pools.get(m.pool) ?? [];
    for (const side of [m.a, m.b]) {
      if (side && byId.has(side) && !list.some((e) => e.id === side)) list.push(byId.get(side)!);
    }
    pools.set(m.pool, list);
  }
  // keep seed order inside each pool
  for (const [k, list] of pools) {
    pools.set(k, entries.filter((e) => list.some((x) => x.id === e.id)));
  }
  return new Map([...pools.entries()].sort(([x], [y]) => poolLetterSort(x, y)));
}

export function poolStandings(config: BracketConfig, entries: Entry[], matches: EngineMatch[]) {
  const pools = poolsFromMatches(entries, matches);
  return new Map(
    [...pools.entries()].map(([letter, members]) => [
      letter,
      computeStandings(
        members,
        matches.filter((m) => m.stage === "pool" && m.pool === letter),
        config.tiebreakers
      ),
    ])
  );
}

/**
 * Knockout seeded from pool results. With two through from a power-of-two number
 * of pools, uses Challonge-style cross seeding (e.g. four pools: A1 v D2, C1 v B2,
 * B1 v C2, D1 v A2) so 1st and 2nd from the same pool are in opposite bracket
 * halves. Otherwise advancers are ranked by place, then record, and seeded normally.
 */
export function knockoutFromPools(
  config: BracketConfig,
  standings: Map<string, StandingRow[]>,
  entries: Entry[],
  opts: {
    newId?: IdFactory;
    startAt: number;
    withdrawn?: Set<string>;
    poolOrder?: string[];
    poolMatches?: EngineMatch[];
  }
): EngineMatch[] {
  const newId = opts.newId ?? randomId;
  const advance = config.pools?.advance ?? 2;
  const order = opts.poolOrder ?? orderedPoolKeys(standings, config, opts.poolMatches);
  const pools = order.filter((k) => standings.has(k)).map((k) => standings.get(k)!.slice(0, advance));
  const byId = new Map(entries.map((e) => [e.id, e]));
  const entry = (r: StandingRow | undefined): Entry | null => (r ? (byId.get(r.id) ?? { id: r.id, name: r.name }) : null);

  let pairs: Pair[] | undefined;
  const isBracket = config.final.type === "single_elimination" || config.final.type === "double_elimination";
  if (isBracket && advance === 2 && challongeAdvanceTwoSupported(pools.length)) {
    pairs = challongePoolKnockoutPairs(
      pools.map((rows) => [entry(rows[0]), entry(rows[1])])
    );
  }

  // place-by-place ranking, used for seeding everything else
  const byPlace: Entry[] = [];
  for (let place = 0; place < advance; place++) {
    const atPlace = pools
      .map((rows) => rows[place])
      .filter(Boolean)
      .sort(
        (x, y) =>
          y.wins - x.wins ||
          y.gamesFor - y.gamesAgainst - (x.gamesFor - x.gamesAgainst) ||
          y.pointsFor - y.pointsAgainst - (x.pointsFor - x.pointsAgainst)
      );
    byPlace.push(...atPlace.map((r) => entry(r)!));
  }

  const matches = finalStage(config, byPlace, newId, pairs);
  numberAndLabel(matches, opts.startAt);
  return settle(matches, { names: namesOf(entries), withdrawn: opts.withdrawn });
}

/** Next Swiss round from the results so far (rounds are generated one at a time). */
export function nextSwissRound(
  config: BracketConfig,
  entries: Entry[],
  previous: EngineMatch[],
  opts: { newId?: IdFactory; startAt: number }
): EngineMatch[] {
  const round = Math.max(0, ...previous.filter((m) => m.stage === "swiss").map((m) => m.round)) + 1;
  const matches = swissRound(entries, previous.filter((m) => m.stage === "swiss"), round, config.tiebreakers, opts.newId);
  numberAndLabel(matches, opts.startAt);
  return matches;
}

/** Which stage a category's matches are in, for the stepper and buttons. */
export function currentSwissRound(matches: EngineMatch[]) {
  return Math.max(0, ...matches.filter((m) => m.stage === "swiss").map((m) => m.round));
}
