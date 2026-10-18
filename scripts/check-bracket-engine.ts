/**
 * Sanity checks for the bracket engine (no database, no framework).
 *
 *   npx jiti scripts/check-bracket-engine.ts
 */
import assert from "node:assert/strict";
import { presetConfig, type BracketConfig } from "../src/lib/bracket-format";
import {
  applyResult,
  computeStandings,
  generateFirstStage,
  knockoutFromPools,
  nextSwissRound,
  poolStandings,
  revertResult,
  type EngineMatch,
  type Entry,
  type MatchPatch,
} from "../src/lib/bracket-engine";

let counter = 0;
const newId = () => `m${++counter}`;
const teams = (n: number): Entry[] => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}` }));
const names = (entries: Entry[]) => new Map(entries.map((e) => [e.id, e.name]));

function applyPatches(matches: EngineMatch[], patches: MatchPatch[]) {
  const byId = new Map(matches.map((m) => [m.id, m]));
  for (const p of patches) Object.assign(byId.get(p.id)!, p);
}

/** Plays every ready match; the lower seed number (tN) wins unless `upset` says otherwise. */
function playAll(matches: EngineMatch[], entries: Entry[], upset?: (m: EngineMatch) => boolean, stages?: Set<string>) {
  const seedOf = (id: string) => Number(id.slice(1));
  for (let guard = 0; guard < 1000; guard++) {
    const ready = matches.find(
      (m) => m.status === "scheduled" && m.a && m.b && !m.isConditional && (!stages || stages.has(m.stage))
    );
    if (!ready) return;
    let winner = seedOf(ready.a!) < seedOf(ready.b!) ? ready.a! : ready.b!;
    if (upset?.(ready)) winner = winner === ready.a ? ready.b! : ready.a!;
    const aWon = winner === ready.a;
    applyPatches(
      matches,
      applyResult(matches, ready.id, winner, [aWon ? [11, 6] : [6, 11], aWon ? [11, 8] : [8, 11]], { names: names(entries) })
    );
  }
  throw new Error("playAll did not terminate");
}

const played = (m: EngineMatch) => !m.isBye && (m.status === "completed" || m.status === "walkover");
let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

check("round robin: 6 teams → 15 matches, 5 each, no repeats", () => {
  const entries = teams(6);
  const { matches } = generateFirstStage(presetConfig("round_robin", 6), entries, { newId });
  assert.equal(matches.length, 15);
  const pairs = new Set(matches.map((m) => [m.a, m.b].sort().join("|")));
  assert.equal(pairs.size, 15);
  for (const e of entries) assert.equal(matches.filter((m) => m.a === e.id || m.b === e.id).length, 5);
});

function qfHasPair(qf: EngineMatch[], a: string, b: string) {
  return qf.some((m) => [m.a, m.b].includes(a) && [m.a, m.b].includes(b));
}

function qfHalfIndex(qf: EngineMatch[], teamId: string, halves: number) {
  const sorted = [...qf].sort((x, y) => x.position - y.position);
  const perHalf = sorted.length / halves;
  const i = sorted.findIndex((m) => m.a === teamId || m.b === teamId);
  assert.ok(i >= 0, `team ${teamId} not in QF`);
  return Math.floor(i / perHalf);
}

check("pools → knockout: 16 teams, Challonge cross-seed QFs, bronze", () => {
  const entries = teams(16);
  const config = presetConfig("pools_knockout", 16);
  const first = generateFirstStage(config, entries, { newId });
  assert.equal(first.state, "pools");
  assert.equal(first.matches.length, 24);
  const poolOf = (id: string) => first.matches.find((m) => m.a === id || m.b === id)!.pool;
  assert.equal(new Set(["t1", "t2", "t3", "t4"].map(poolOf)).size, 4);

  playAll(first.matches, entries);
  const standings = poolStandings(config, entries, first.matches);
  const ko = knockoutFromPools(config, standings, entries, { newId, startAt: 25 });
  const real = ko.filter((m) => !m.isBye);
  assert.equal(real.length, 8, "7 knockout matches + bronze");
  const qf = ko.filter((m) => m.stage === "winners" && m.round === 1);
  const id = (pool: string, place: number) => standings.get(pool)![place].id;
  assert.ok(qfHasPair(qf, id("A", 0), id("D", 1)), "A1 vs D2");
  assert.ok(qfHasPair(qf, id("C", 0), id("B", 1)), "C1 vs B2");
  assert.ok(qfHasPair(qf, id("B", 0), id("C", 1)), "B1 vs C2");
  assert.ok(qfHasPair(qf, id("D", 0), id("A", 1)), "D1 vs A2");
  assert.notEqual(qfHalfIndex(qf, id("A", 0), 2), qfHalfIndex(qf, id("A", 1), 2), "A1 and A2 in opposite halves");
  assert.equal(Math.min(...ko.map((m) => m.matchNumber)), 25);
});

check("pools → knockout: 8 teams, 2 pools, A1–B2 / B1–A2", () => {
  const entries = teams(8);
  const config = presetConfig("pools_knockout", 8);
  const first = generateFirstStage(config, entries, { newId });
  playAll(first.matches, entries);
  const standings = poolStandings(config, entries, first.matches);
  const ko = knockoutFromPools(config, standings, entries, { newId, startAt: 10 });
  const qf = ko.filter((m) => m.stage === "winners" && m.round === 1);
  const id = (pool: string, place: number) => standings.get(pool)![place].id;
  assert.ok(qfHasPair(qf, id("A", 0), id("B", 1)), "A1 vs B2");
  assert.ok(qfHasPair(qf, id("B", 0), id("A", 1)), "B1 vs A2");
});

check("knockout: 12 teams → 4 byes auto-advanced, champion reachable", () => {
  const entries = teams(12);
  const { matches } = generateFirstStage(presetConfig("knockout", 12), entries, { newId });
  const byes = matches.filter((m) => m.isBye && m.status === "completed");
  assert.equal(byes.length, 4);
  // byes went to seeds 1–4
  assert.deepEqual(byes.map((m) => m.winner).sort(), ["t1", "t2", "t3", "t4"]);
  playAll(matches, entries);
  const final = matches.find((m) => m.stage === "winners" && !m.nextMatchId)!;
  assert.equal(final.winner, "t1");
  const bronze = matches.find((m) => m.stage === "third_place")!;
  assert.equal(bronze.status, "completed");
});

check("double knockout: 8 teams → 14 matches + conditional decider; every loser drops once", () => {
  const entries = teams(8);
  const config = presetConfig("double_knockout", 8);
  const { matches } = generateFirstStage(config, entries, { newId });
  assert.equal(matches.filter((m) => !m.isConditional).length, 14);
  assert.equal(matches.filter((m) => m.isConditional).length, 1);
  for (const m of matches.filter((x) => x.stage === "winners")) {
    assert.ok(m.loserNextMatchId || m.round === Math.max(...matches.filter((x) => x.stage === "winners").map((x) => x.round)) || m.nextMatchId);
  }
  // losers'-side team wins the first grand final → decider is played
  playAll(matches, entries, (m) => m.stage === "grand_final");
  const reset = matches.find((m) => m.stage === "grand_final_reset")!;
  assert.equal(reset.isConditional, false);
  assert.equal(reset.status, "completed");
  const losses = new Map<string, number>();
  for (const m of matches.filter(played)) {
    const loser = m.winner === m.a ? m.b! : m.a!;
    losses.set(loser, (losses.get(loser) ?? 0) + 1);
  }
  for (const [, n] of losses) assert.ok(n <= 2, "nobody is eliminated before losing twice");
});

check("double knockout: decider cancelled when the unbeaten finalist wins", () => {
  const entries = teams(6);
  const { matches } = generateFirstStage(presetConfig("double_knockout", 6), entries, { newId });
  playAll(matches, entries);
  assert.equal(matches.find((m) => m.stage === "grand_final_reset")!.status, "cancelled");
});

check("swiss: 9 teams × 4 rounds → no rematches, no double byes", () => {
  const entries = teams(9); // odd field so byes happen
  const config: BracketConfig = { ...presetConfig("swiss", 9), final: { ...presetConfig("swiss", 9).final, rounds: 4 } };
  const all: EngineMatch[] = generateFirstStage(config, entries, { newId }).matches;
  playAll(all, entries);
  for (let r = 2; r <= 4; r++) {
    const next = nextSwissRound(config, entries, all, { newId, startAt: all.length + 1 });
    all.push(...next);
    playAll(all, entries);
  }
  const pairs = all.filter((m) => m.a && m.b).map((m) => [m.a, m.b].sort().join("|"));
  assert.equal(new Set(pairs).size, pairs.length, "no rematches");
  const byes = all.filter((m) => m.isBye).map((m) => m.winner);
  assert.equal(new Set(byes).size, byes.length, "nobody gets two byes");
});

check("standings: head-to-head between tied teams; points split a circular tie", () => {
  const entries = teams(3);
  const mk = (a: string, b: string, winner: string, games: Array<[number, number]>): EngineMatch => ({
    ...generateFirstStage(presetConfig("round_robin", 3), entries, { newId }).matches[0],
    id: newId(), a, b, winner, status: "completed", gameScores: games, isBye: false,
  });
  const order = ["match_wins", "head_to_head", "game_diff", "point_diff", "points_scored"] as const;
  // circular: t1 > t2 > t3 > t1 — head-to-head and games (all 2–0) can't split;
  // points can: t1 +14, t3 0, t2 −14
  const circular = [
    mk("t1", "t2", "t1", [[11, 2], [11, 2]]),
    mk("t2", "t3", "t2", [[11, 9], [11, 9]]),
    mk("t3", "t1", "t3", [[11, 9], [11, 9]]),
  ];
  const rows = computeStandings(entries, circular, [...order]);
  assert.deepEqual(rows.map((r) => r.id), ["t1", "t3", "t2"]);
  assert.equal(rows[0].decidedBy, "point_diff");

  // t2 and t3 both win 2; t3 won their meeting, so t3 ranks higher despite t2's bigger margins.
  // t1 and t4 both win 1; t4 won theirs.
  const four = teams(4);
  const h2h = [
    mk("t3", "t2", "t3", [[11, 9], [11, 9]]),
    mk("t2", "t1", "t2", [[11, 0], [11, 0]]),
    mk("t2", "t4", "t2", [[11, 0], [11, 0]]),
    mk("t3", "t4", "t3", [[11, 9], [11, 9]]),
    mk("t1", "t3", "t1", [[11, 9], [11, 9]]),
    mk("t4", "t1", "t4", [[11, 9], [11, 9]]),
  ];
  const r4 = computeStandings(four, h2h, [...order]);
  assert.deepEqual(r4.map((r) => r.id), ["t3", "t2", "t4", "t1"]);
  assert.equal(r4[0].decidedBy, "head_to_head");
});

check("withdrawal: opponent gets a walkover and moves on", () => {
  const entries = teams(4);
  const { matches } = generateFirstStage(presetConfig("knockout", 4), entries, { newId });
  const semi = matches.find((m) => m.a === "t4" || m.b === "t4")!;
  const opponent = semi.a === "t4" ? semi.b : semi.a;
  const settled = generateFirstStage(presetConfig("knockout", 4), entries, { newId, withdrawn: new Set(["t4"]) }).matches;
  const s2 = settled.find((m) => m.a === "t4" || m.b === "t4")!;
  assert.equal(s2.status, "walkover");
  assert.equal(s2.winner, opponent);
  const final = settled.find((m) => m.id === s2.nextMatchId)!;
  assert.ok(final.a === opponent || final.b === opponent);
});

check("correct result: allowed before the next match starts, blocked after", () => {
  const entries = teams(4);
  const { matches } = generateFirstStage(presetConfig("knockout", 4), entries, { newId });
  const semi = matches.find((m) => m.stage === "winners" && m.round === 1)!;
  applyPatches(matches, applyResult(matches, semi.id, semi.a!, [[11, 3], [11, 3]], { names: names(entries) }));
  const undo = revertResult(matches, semi.id);
  assert.ok("patches" in undo);
  applyPatches(matches, (undo as { patches: MatchPatch[] }).patches);
  assert.equal(matches.find((m) => m.id === semi.nextMatchId)!.a, null);

  applyPatches(matches, applyResult(matches, semi.id, semi.a!, [[11, 3], [11, 3]], { names: names(entries) }));
  const final = matches.find((m) => m.id === semi.nextMatchId)!;
  final.scoreA = 3; // final has started
  assert.ok("error" in revertResult(matches, semi.id));
});

console.log(`\n${passed} checks passed`);
