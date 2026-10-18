import type { Tiebreaker } from "../bracket-format";
import type { EngineMatch, Entry } from "./types";

export type PoolMatchHistoryEntry = { outcome: "W" | "L"; tooltip: string };

const DECIDED = new Set(["completed", "walkover"]);

function poolMatchesForEntry(entryId: string, poolMatches: EngineMatch[]): EngineMatch[] {
  return poolMatches
    .filter(
      (m) =>
        m.stage === "pool" &&
        DECIDED.has(m.status) &&
        m.winner &&
        !m.isBye &&
        m.a &&
        m.b &&
        (m.a === entryId || m.b === entryId)
    )
    .sort((x, y) => x.round - y.round || x.position - y.position || x.matchNumber - y.matchNumber);
}

function scoreLine(m: EngineMatch, entryId: string): string {
  const opp = m.a === entryId ? m.bLabel : m.aLabel;
  const scores = m.gameScores?.map(([a, b]) => `${a}–${b}`).join(", ");
  return scores ? `${opp} (${scores})` : opp;
}

/** W/L in pool schedule order for match-history badges. */
export function poolMatchHistory(entryId: string, poolMatches: EngineMatch[]): Array<"W" | "L"> {
  return poolMatchHistoryEntries(entryId, poolMatches).map((e) => e.outcome);
}

export function poolMatchHistoryEntries(entryId: string, poolMatches: EngineMatch[]): PoolMatchHistoryEntry[] {
  return poolMatchesForEntry(entryId, poolMatches).map((m) => ({
    outcome: m.winner === entryId ? "W" : "L",
    tooltip: scoreLine(m, entryId),
  }));
}

export type StandingRow = {
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  gamesFor: number;
  gamesAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
  /** 1-based finishing position */
  rank: number;
  /** the tiebreaker that separated this row from a team on equal record, if any */
  decidedBy: Tiebreaker | "seed" | null;
};

/**
 * Standings for a set of entries from their decided matches. Byes count as a
 * win with no games. Ties are broken by `tiebreakers` in order; head-to-head
 * only counts matches between the teams still tied. Remaining ties fall back
 * to seed order.
 */
export function computeStandings(
  entries: Entry[],
  matches: EngineMatch[],
  tiebreakers: Tiebreaker[]
): StandingRow[] {
  const ids = new Set(entries.map((e) => e.id));
  const seed = new Map(entries.map((e, i) => [e.id, i]));
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [
      e.id,
      {
        id: e.id,
        name: e.name,
        played: 0,
        wins: 0,
        losses: 0,
        gamesFor: 0,
        gamesAgainst: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        rank: 0,
        decidedBy: null,
      },
    ])
  );

  const decided = matches.filter((m) => DECIDED.has(m.status) && m.winner);
  for (const m of decided) {
    if (m.isBye) {
      const r = m.winner ? rows.get(m.winner) : undefined;
      if (r) r.wins += 1;
      continue;
    }
    if (!m.a || !m.b || !ids.has(m.a) || !ids.has(m.b)) continue;
    const ra = rows.get(m.a)!;
    const rb = rows.get(m.b)!;
    ra.played += 1;
    rb.played += 1;
    const aWon = m.winner === m.a;
    (aWon ? ra : rb).wins += 1;
    (aWon ? rb : ra).losses += 1;
    for (const [x, y] of m.gameScores ?? []) {
      ra.pointsFor += x;
      ra.pointsAgainst += y;
      rb.pointsFor += y;
      rb.pointsAgainst += x;
      if (x > y) {
        ra.gamesFor += 1;
        rb.gamesAgainst += 1;
      } else if (y > x) {
        rb.gamesFor += 1;
        ra.gamesAgainst += 1;
      }
    }
  }

  const headToHead = (group: StandingRow[]) => {
    const members = new Set(group.map((r) => r.id));
    const wins = new Map(group.map((r) => [r.id, 0]));
    for (const m of decided) {
      if (m.isBye || !m.a || !m.b || !members.has(m.a) || !members.has(m.b)) continue;
      wins.set(m.winner!, (wins.get(m.winner!) ?? 0) + 1);
    }
    return wins;
  };

  const value = (c: Tiebreaker, r: StandingRow, h2h?: Map<string, number>) => {
    switch (c) {
      case "match_wins":
        return r.wins;
      case "head_to_head":
        return h2h?.get(r.id) ?? 0;
      case "game_diff":
        return r.gamesFor - r.gamesAgainst;
      case "point_diff":
        return r.pointsFor - r.pointsAgainst;
      case "points_scored":
        return r.pointsFor;
    }
  };

  const primary = tiebreakers[0];
  const order = (group: StandingRow[], criteria: Tiebreaker[]): StandingRow[] => {
    if (group.length <= 1) return group;
    if (!criteria.length) {
      const bySeed = [...group].sort((x, y) => seed.get(x.id)! - seed.get(y.id)!);
      bySeed.forEach((r) => (r.decidedBy ??= "seed"));
      return bySeed;
    }
    const [c, ...rest] = criteria;
    const h2h = c === "head_to_head" ? headToHead(group) : undefined;
    const buckets = new Map<number, StandingRow[]>();
    for (const r of group) {
      const v = value(c, r, h2h);
      buckets.set(v, [...(buckets.get(v) ?? []), r]);
    }
    if (buckets.size > 1 && c !== primary) {
      // this criterion actually separated teams that were level so far
      group.forEach((r) => (r.decidedBy ??= c));
    }
    return [...buckets.entries()]
      .sort(([x], [y]) => y - x)
      .flatMap(([, members]) => order(members, rest));
  };

  const ranked = order([...rows.values()], tiebreakers);
  ranked.forEach((r, i) => (r.rank = i + 1));
  return ranked;
}
