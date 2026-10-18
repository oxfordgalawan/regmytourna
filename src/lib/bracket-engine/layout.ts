import { poolSizes, type BracketConfig } from "../bracket-format";
import { nextPowerOfTwo, snakePools } from "./seeding";
import type { Entry } from "./types";

export type PoolGroup = { entryIds: string[] };
export type SeedingLayout = {
  mode: "standard" | "manual";
  poolGroups?: PoolGroup[];
  knockoutSlots?: (string | null)[];
};

export function usesMultiPool(config: BracketConfig, teamCount: number): boolean {
  return Boolean(config.pools && teamCount > config.pools.size);
}

export function usesKnockoutSlotSeeding(config: BracketConfig, teamCount: number): boolean {
  if (usesMultiPool(config, teamCount)) return false;
  return config.final.type === "single_elimination" || config.final.type === "double_elimination";
}

/** Snake-deal entries into pool groups (same as start-time standard path). */
export function initPoolGroupsFromSnake(entries: Entry[], config: BracketConfig): PoolGroup[] {
  if (!config.pools || entries.length <= config.pools.size) return [{ entryIds: entries.map((e) => e.id) }];
  const pools = snakePools(entries, poolSizes(entries.length, config.pools.size));
  return pools.map((members) => ({ entryIds: members.map((e) => e.id) }));
}

/** Seed lines 1…n in list order; remaining bracket slots empty (byes). */
export function initKnockoutSlotsFromOrder(entries: Entry[]): (string | null)[] {
  const size = nextPowerOfTwo(Math.max(entries.length, 2));
  return Array.from({ length: size }, (_, i) => (i < entries.length ? entries[i].id : null));
}

export function poolGroupsToEntryPools(poolGroups: PoolGroup[], entries: Entry[]): Entry[][] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  return poolGroups
    .map((g) => g.entryIds.map((id) => byId.get(id)).filter((e): e is Entry => Boolean(e)))
    .filter((p) => p.length > 0);
}

/** Sparse seed-indexed list for `seededPairs` (index i = seed i+1). */
export function entriesFromKnockoutSlots(slots: (string | null)[], allEntries: Entry[]): Entry[] {
  const byId = new Map(allEntries.map((e) => [e.id, e]));
  const size = nextPowerOfTwo(Math.max(slots.length, allEntries.length, 2));
  return Array.from({ length: size }, (_, i) => {
    const id = i < slots.length ? slots[i] : null;
    if (id && byId.has(id)) return byId.get(id)!;
    return undefined as unknown as Entry;
  });
}

export function entryIdsInPoolGroups(poolGroups: PoolGroup[] | undefined): Set<string> {
  const s = new Set<string>();
  for (const g of poolGroups ?? []) for (const id of g.entryIds) s.add(id);
  return s;
}

export function entryIdsInKnockoutSlots(slots: (string | null)[] | undefined): Set<string> {
  const s = new Set<string>();
  for (const id of slots ?? []) if (id) s.add(id);
  return s;
}

export function validateSeedingLayout(
  config: BracketConfig,
  entryIds: string[]
): { ok: true } | { ok: false; errors: string[] } {
  const layout = config.seedingLayout;
  if (!layout || layout.mode !== "manual") return { ok: true };

  const errors: string[] = [];
  const valid = new Set(entryIds);
  const assigned = new Set<string>();
  const n = entryIds.length;

  if (usesMultiPool(config, n)) {
    const max = config.pools!.size;
    const groups = layout.poolGroups ?? [];
    if (groups.length < 1) errors.push("Add at least one pool.");
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      if (g.entryIds.length > max) errors.push(`Pool ${gi + 1} has more than ${max} teams.`);
      for (const id of g.entryIds) {
        if (!valid.has(id)) errors.push("Pool layout includes an entry that isn't in this category.");
        if (assigned.has(id)) errors.push("The same team appears in more than one pool.");
        assigned.add(id);
      }
    }
    for (const id of entryIds) {
      if (!assigned.has(id)) errors.push("Every team must be assigned to a pool before you start.");
    }
  } else if (usesKnockoutSlotSeeding(config, n)) {
    const slots = layout.knockoutSlots;
    if (!slots?.length) {
      errors.push("Set up the bracket before you start.");
      return { ok: false, errors };
    }
    for (let i = 0; i < slots.length; i++) {
      const id = slots[i];
      if (!id) continue;
      if (!valid.has(id)) errors.push("Bracket layout includes an entry that isn't in this category.");
      if (assigned.has(id)) errors.push("The same team is placed on more than one seed line.");
      assigned.add(id);
    }
    for (const id of entryIds) {
      if (!assigned.has(id)) errors.push("Every team must be placed on the bracket before you start.");
    }
  }

  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  return { ok: true };
}

/** Global seed order (1 = first id) for `registrations.seed`. */
export function flattenSeedsFromLayout(
  config: BracketConfig,
  entryIds: string[],
  listOrder: string[]
): string[] {
  const layout = config.seedingLayout;
  const valid = new Set(entryIds);
  const listRank = new Map(listOrder.filter((id) => valid.has(id)).map((id, i) => [id, i]));

  if (!layout || layout.mode !== "manual") {
    return listOrder.filter((id) => valid.has(id));
  }

  if (usesMultiPool(config, entryIds.length) && layout.poolGroups?.length) {
    const out: string[] = [];
    const inPools = new Set<string>();
    for (const g of layout.poolGroups) {
      for (const id of g.entryIds) {
        if (valid.has(id) && !inPools.has(id)) {
          out.push(id);
          inPools.add(id);
        }
      }
    }
    const rest = entryIds.filter((id) => !inPools.has(id)).sort((a, b) => (listRank.get(a) ?? 0) - (listRank.get(b) ?? 0));
    return [...out, ...rest];
  }

  if (usesKnockoutSlotSeeding(config, entryIds.length) && layout.knockoutSlots?.length) {
    const slots = layout.knockoutSlots;
    const bySeed: { id: string; seed: number }[] = [];
    const placed = new Set<string>();
    for (let i = 0; i < slots.length; i++) {
      const id = slots[i];
      if (id && valid.has(id)) {
        bySeed.push({ id, seed: i });
        placed.add(id);
      }
    }
    bySeed.sort((x, y) => x.seed - y.seed);
    const rest = entryIds.filter((id) => !placed.has(id)).sort((a, b) => (listRank.get(a) ?? 0) - (listRank.get(b) ?? 0));
    return [...bySeed.map((x) => x.id), ...rest];
  }

  return listOrder.filter((id) => valid.has(id));
}

export function mergeLayoutWithEntries(
  config: BracketConfig,
  entries: Entry[],
  existing?: SeedingLayout | null
): SeedingLayout {
  const mode = existing?.mode ?? "standard";
  const n = entries.length;
  if (usesMultiPool(config, n)) {
    let poolGroups = existing?.poolGroups;
    if (!poolGroups?.length) poolGroups = initPoolGroupsFromSnake(entries, config);
    else {
      const known = new Set(entries.map((e) => e.id));
      const inLayout = entryIdsInPoolGroups(poolGroups);
      const newcomers = entries.filter((e) => !inLayout.has(e.id)).map((e) => e.id);
      poolGroups = poolGroups
        .map((g) => ({ entryIds: g.entryIds.filter((id) => known.has(id)) }))
        .filter((g) => g.entryIds.length > 0 || mode === "manual");
      if (newcomers.length) {
        if (poolGroups.length === 0) poolGroups = [{ entryIds: [] }];
        poolGroups[0] = { entryIds: [...poolGroups[0].entryIds, ...newcomers] };
      }
      if (poolGroups.length === 0) poolGroups = initPoolGroupsFromSnake(entries, config);
    }
    return { mode, poolGroups };
  }
  if (usesKnockoutSlotSeeding(config, n)) {
    let knockoutSlots = existing?.knockoutSlots;
    const known = new Set(entries.map((e) => e.id));
    if (!knockoutSlots?.length) knockoutSlots = initKnockoutSlotsFromOrder(entries);
    else {
      knockoutSlots = knockoutSlots.map((id) => (id && known.has(id) ? id : null));
      const placed = entryIdsInKnockoutSlots(knockoutSlots);
      const unplaced = entries.filter((e) => !placed.has(e.id));
      if (unplaced.length) {
        for (let i = 0; i < knockoutSlots.length && unplaced.length; i++) {
          if (!knockoutSlots[i]) {
            knockoutSlots[i] = unplaced.shift()!.id;
          }
        }
      }
    }
    return { mode, knockoutSlots };
  }
  return { mode };
}
