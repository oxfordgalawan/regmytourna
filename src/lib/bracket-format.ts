import { z } from "zod";

/**
 * Bracket formats in plain language.
 *
 * A category's format is stored as `tournament_divisions.bracket_config`.
 * Everything here is pure (no React, no I/O) so the create form, the edit
 * dialog, the public page and the Challonge sync all agree on the same math.
 */

/** Challonge states after which a category's format can no longer change. */
export const LOCKED_BRACKET_STATES = new Set(["underway", "group_stages_underway", "awaiting_review", "complete"]);

export const FINAL_TYPES = ["single_elimination", "double_elimination", "round_robin", "swiss"] as const;
export type FinalType = (typeof FINAL_TYPES)[number];

/** Tiebreakers for standings, applied in the organizer's chosen order. */
export const TIEBREAKERS = ["match_wins", "head_to_head", "game_diff", "point_diff", "points_scored"] as const;
export type Tiebreaker = (typeof TIEBREAKERS)[number];
export const DEFAULT_TIEBREAKERS: Tiebreaker[] = [...TIEBREAKERS];

export const PRESET_IDS = [
  "pools_knockout",
  "knockout",
  "double_knockout",
  "round_robin",
  "swiss",
  "custom",
] as const;
export type PresetId = (typeof PRESET_IDS)[number];

const poolsSchema = z.object({
  size: z.number().int().min(3).max(20),
  advance: z.number().int().min(1).max(19),
  playEachOther: z.union([z.literal(1), z.literal(2)]),
});

const finalSchema = z.object({
  type: z.enum(FINAL_TYPES),
  thirdPlaceMatch: z.boolean(),
  /** double knockout only: reset = losers'-side finalist must win twice */
  grandFinal: z.enum(["reset", "single", "none"]),
  splitParticipants: z.boolean(),
  /** round robin final only */
  playEachOther: z.union([z.literal(1), z.literal(2)]),
  /** swiss only */
  rounds: z.number().int().min(1).max(20),
  matchWinPoints: z.number().min(0).max(10),
  matchTiePoints: z.number().min(0).max(10),
});

export const DEFAULT_GAMES_TO_WIN = 2;

export const bracketConfigSchema = z.object({
  preset: z.enum(PRESET_IDS),
  pools: poolsSchema.nullable(),
  final: finalSchema,
  /** how tied teams are ordered in pool / round-robin / Swiss standings */
  tiebreakers: z.array(z.enum(TIEBREAKERS)).min(1).default(DEFAULT_TIEBREAKERS),
  /** games a side must win to take the match (umpire scoring) */
  gamesToWin: z.number().int().min(1).max(3).default(DEFAULT_GAMES_TO_WIN),
});

export function matchGamesToWinHint(gamesToWin: number): string {
  if (gamesToWin === 1) return "Single game — one game decides the match.";
  if (gamesToWin === 2) return "Best of 3 — first to 2 games wins.";
  return "Best of 5 — first to 3 games wins.";
}

export function gamesToWinFromDivisionConfig(config: BracketConfig): number {
  const n = config.gamesToWin ?? DEFAULT_GAMES_TO_WIN;
  return n >= 1 && n <= 3 ? n : DEFAULT_GAMES_TO_WIN;
}

export type BracketConfig = z.infer<typeof bracketConfigSchema>;
export type PoolsConfig = z.infer<typeof poolsSchema>;
export type FinalConfig = z.infer<typeof finalSchema>;

export const PRESETS: Record<
  PresetId,
  { label: string; tagline: string; bestFor: string }
> = {
  pools_knockout: {
    label: "Pools → Knockout",
    tagline: "Small round-robin pools, then the top teams play a knockout.",
    bestFor: "Most pickleball events with 8+ teams",
  },
  knockout: {
    label: "Knockout",
    tagline: "Lose once and you're out. Fastest way to a champion.",
    bestFor: "Big fields or a tight schedule",
  },
  double_knockout: {
    label: "Double knockout",
    tagline: "Everyone gets a second life — you're out after two losses.",
    bestFor: "Competitive events where one bad game shouldn't end your day",
  },
  round_robin: {
    label: "Round robin",
    tagline: "Everyone plays everyone. Most games for every team.",
    bestFor: "Up to about 7 teams",
  },
  swiss: {
    label: "Swiss",
    tagline: "A set number of rounds; you face teams with a similar record.",
    bestFor: "Large social events where nobody is knocked out",
  },
  custom: {
    label: "Custom",
    tagline: "Pick each stage yourself.",
    bestFor: "When none of the above fit",
  },
};

export const TIEBREAKER_LABELS: Record<Tiebreaker, { label: string; hint: string }> = {
  match_wins: { label: "Matches won", hint: "More match wins ranks higher." },
  head_to_head: {
    label: "Head-to-head",
    hint: "Between tied teams, the winner of their match ranks higher.",
  },
  game_diff: { label: "Game difference", hint: "Games won minus games lost." },
  point_diff: { label: "Point difference", hint: "Points scored minus points conceded." },
  points_scored: { label: "Points scored", hint: "Total points, regardless of results." },
};

export const FINAL_TYPE_LABELS: Record<FinalType, string> = {
  single_elimination: "Knockout",
  double_elimination: "Double knockout",
  round_robin: "Round robin",
  swiss: "Swiss",
};

const log2Ceil = (n: number) => Math.max(0, Math.ceil(Math.log2(Math.max(1, n))));

function baseFinal(patch: Partial<FinalConfig> = {}): FinalConfig {
  return {
    type: "single_elimination",
    thirdPlaceMatch: true,
    grandFinal: "reset",
    splitParticipants: false,
    playEachOther: 1,
    rounds: 4,
    matchWinPoints: 1,
    matchTiePoints: 0.5,
    ...patch,
  };
}

/** Builds the config for a preset, sized sensibly for the team count. */
export function presetConfig(preset: PresetId, teamCount: number): BracketConfig {
  const swissRounds = Math.max(1, Math.min(20, log2Ceil(teamCount)));
  switch (preset) {
    case "pools_knockout":
    case "custom":
      return {
        preset,
        pools: { size: 4, advance: 2, playEachOther: 1 },
        final: baseFinal({ rounds: swissRounds }),
        tiebreakers: DEFAULT_TIEBREAKERS,
        gamesToWin: DEFAULT_GAMES_TO_WIN,
      };
    case "knockout":
      return {
        preset,
        pools: null,
        final: baseFinal({ rounds: swissRounds }),
        tiebreakers: DEFAULT_TIEBREAKERS,
        gamesToWin: DEFAULT_GAMES_TO_WIN,
      };
    case "double_knockout":
      return {
        preset,
        pools: null,
        final: baseFinal({ type: "double_elimination", thirdPlaceMatch: false, rounds: swissRounds }),
        tiebreakers: DEFAULT_TIEBREAKERS,
        gamesToWin: DEFAULT_GAMES_TO_WIN,
      };
    case "round_robin":
      return {
        preset,
        pools: null,
        final: baseFinal({ type: "round_robin", thirdPlaceMatch: false, rounds: swissRounds }),
        tiebreakers: DEFAULT_TIEBREAKERS,
        gamesToWin: DEFAULT_GAMES_TO_WIN,
      };
    case "swiss":
      return {
        preset,
        pools: null,
        final: baseFinal({ type: "swiss", thirdPlaceMatch: false, rounds: swissRounds }),
        tiebreakers: DEFAULT_TIEBREAKERS,
        gamesToWin: DEFAULT_GAMES_TO_WIN,
      };
  }
}

/** The format we suggest for a category of this size. */
export function recommendedPreset(teamCount: number): PresetId {
  return teamCount >= 8 ? "pools_knockout" : "round_robin";
}

export function defaultConfigFor(teamCount: number): BracketConfig {
  return presetConfig(recommendedPreset(teamCount), teamCount);
}

/** Reads a stored config, falling back to the recommended one if missing/invalid. */
export function parseBracketConfig(raw: unknown, teamCount: number): BracketConfig {
  const parsed = bracketConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultConfigFor(teamCount);
}

// ───────────────────────────── Math ─────────────────────────────

/** Splits n teams into g pools as evenly as possible; returns pool sizes. */
export function poolSizes(teams: number, size: number): number[] {
  if (teams <= 0) return [];
  const count = Math.max(1, Math.ceil(teams / size));
  const base = Math.floor(teams / count);
  const extra = teams % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

type StageMath = { matches: number; matchesMax: number; guaranteedGames: number; rounds: number };

function finalStageMath(final: FinalConfig, n: number): StageMath {
  if (n < 2) return { matches: 0, matchesMax: 0, guaranteedGames: 0, rounds: 0 };
  switch (final.type) {
    case "single_elimination": {
      const third = final.thirdPlaceMatch && n >= 4 ? 1 : 0;
      return { matches: n - 1 + third, matchesMax: n - 1 + third, guaranteedGames: 1, rounds: log2Ceil(n) };
    }
    case "double_elimination": {
      const base = 2 * n - 2;
      const min = final.grandFinal === "none" ? base - 1 : base;
      const max = final.grandFinal === "reset" ? base + 1 : min;
      return { matches: min, matchesMax: max, guaranteedGames: 2, rounds: log2Ceil(n) * 2 };
    }
    case "round_robin": {
      const m = (final.playEachOther * n * (n - 1)) / 2;
      return { matches: m, matchesMax: m, guaranteedGames: final.playEachOther * (n - 1), rounds: final.playEachOther * (n % 2 ? n : n - 1) };
    }
    case "swiss": {
      const m = Math.floor(n / 2) * final.rounds;
      // with an odd field someone sits out (bye) each round
      return { matches: m, matchesMax: m, guaranteedGames: n % 2 ? Math.max(0, final.rounds - 1) : final.rounds, rounds: final.rounds };
    }
  }
}

/** Circle-method schedule rounds inside one pool (one match per team per round). */
export function poolScheduleRoundsPerPool(poolSize: number, playEachOther: 1 | 2): number {
  return playEachOther * (poolSize % 2 === 0 ? poolSize - 1 : poolSize);
}

export type FormatSummary = {
  teams: number;
  pools: number[] | null;
  /** When pools are configured: schedule rounds inside a full pool of `pools.size`. */
  poolScheduleRoundsPerPool: number | null;
  advancing: number;
  knockoutSize: number;
  byes: number;
  poolMatches: number;
  finalMatches: number;
  finalMatchesMax: number;
  totalMatches: number;
  totalMatchesMax: number;
  guaranteedGames: number;
  warnings: string[];
};

export function summarize(config: BracketConfig, teams: number): FormatSummary {
  const warnings: string[] = [];
  let pools: number[] | null = null;
  let poolScheduleRounds: number | null = null;
  let poolMatches = 0;
  let advancing = teams;
  let guaranteed = 0;

  if (teams < 2) warnings.push("A category needs at least 2 teams.");

  if (config.pools) {
    const { size, advance, playEachOther } = config.pools;
    pools = poolSizes(teams, size);
    poolScheduleRounds = poolScheduleRoundsPerPool(size, playEachOther);
    const smallest = Math.min(...pools);
    poolMatches = pools.reduce((n, s) => n + (playEachOther * s * (s - 1)) / 2, 0);
    guaranteed = playEachOther * (smallest - 1);
    advancing = pools.length * advance;

    if (pools.length === 1) warnings.push("Only one pool fits — consider plain round robin instead.");
    if (smallest < 3 && teams >= 3) warnings.push(`One pool would only have ${smallest} teams.`);
    if (new Set(pools).size > 1) {
      const big = pools.filter((s) => s === pools![0]).length;
      warnings.push(
        `Pools are uneven: ${big} of ${pools[0]} and ${pools.length - big} of ${pools[pools.length - 1]}.`
      );
    }
    if (advance >= smallest) {
      warnings.push(`Top ${advance} can't advance from a pool of ${smallest} — lower the number advancing.`);
    }
  }

  const final = finalStageMath(config.final, advancing);
  const isBracket =
    config.final.type === "single_elimination" || config.final.type === "double_elimination";
  const knockoutSize = isBracket ? 2 ** log2Ceil(advancing) : 0;
  const byes = isBracket ? knockoutSize - advancing : 0;
  if (byes > 0 && advancing >= 3) {
    warnings.push(
      `${advancing} teams in the knockout means ${byes} ${byes === 1 ? "team gets" : "teams get"} a bye in the first round.`
    );
  }
  // with pools, pool games are the guarantee; knockout games are a bonus
  if (!config.pools) guaranteed = final.guaranteedGames;

  return {
    teams,
    pools,
    poolScheduleRoundsPerPool: poolScheduleRounds,
    advancing,
    knockoutSize,
    byes,
    poolMatches,
    finalMatches: final.matches,
    finalMatchesMax: final.matchesMax,
    totalMatches: poolMatches + final.matches,
    totalMatchesMax: poolMatches + final.matchesMax,
    guaranteedGames: Math.max(0, guaranteed),
    warnings,
  };
}

/** Short label, e.g. "Pools → Knockout · 32 matches". */
export function describeFormat(config: BracketConfig, teams: number) {
  const s = summarize(config, teams);
  const matches =
    s.totalMatches === s.totalMatchesMax ? `${s.totalMatches}` : `${s.totalMatches}–${s.totalMatchesMax}`;
  const gamesToWin = gamesToWinFromDivisionConfig(config);
  return {
    name: config.preset === "custom" ? customName(config) : PRESETS[config.preset].label,
    matches: `${matches} matches`,
    guaranteed: `${s.guaranteedGames} ${s.guaranteedGames === 1 ? "game" : "games"} guaranteed`,
    scoring: gamesToWin === 1 ? "First to 1 game" : `First to ${gamesToWin} games`,
  };
}

function customName(config: BracketConfig) {
  const final = FINAL_TYPE_LABELS[config.final.type];
  return config.pools ? `Pools → ${final}` : final;
}

// ───────────────────────────── Challonge ─────────────────────────────

const CHALLONGE_TYPE: Record<FinalType, string> = {
  single_elimination: "single elimination",
  double_elimination: "double elimination",
  round_robin: "round robin",
  swiss: "swiss",
};

const CHALLONGE_RANK: Partial<Record<Tiebreaker, string>> = {
  match_wins: "match wins",
  game_diff: "game wins",
  point_diff: "points difference",
  points_scored: "points scored",
};

/** Challonge only ranks by one stat: use the first of ours it understands. */
function challongeRanking(config: BracketConfig) {
  for (const t of config.tiebreakers) if (CHALLONGE_RANK[t]) return CHALLONGE_RANK[t]!;
  return "match wins";
}

const CHALLONGE_GRAND_FINAL = { reset: "", single: "single match", none: "skip" } as const;

/**
 * Maps our config to Challonge API v2.1 `POST /tournaments` attributes.
 * Field names follow the v2.1 reference (challonge.apidog.io, "Create Tournament").
 * This is the only place that knows Challonge's vocabulary.
 */
export function toChallongeTournament(
  config: BracketConfig,
  meta: { name: string; url: string; description?: string; startsAt?: string | null }
): Record<string, unknown> {
  const f = config.final;
  const attrs: Record<string, unknown> = {
    name: meta.name.slice(0, 60),
    url: meta.url,
    tournament_type: CHALLONGE_TYPE[f.type],
    game_name: "Pickleball",
    private: false,
    ...(meta.description ? { description: meta.description } : {}),
    ...(meta.startsAt ? { starts_at: meta.startsAt } : {}),
  };

  if (f.type === "single_elimination" || f.type === "double_elimination") {
    // v2.1 has no "third place match" flag: consolation matches decide placings
    // down to this rank. 3 = play for bronze; 2 = no extra placement match.
    attrs.match_options = { consolation_matches_target_rank: f.thirdPlaceMatch ? 3 : 2 };
  }
  if (f.type === "double_elimination") {
    attrs.double_elimination_options = {
      split_participants: f.splitParticipants,
      grand_finals_modifier: CHALLONGE_GRAND_FINAL[f.grandFinal],
    };
  }
  if (f.type === "round_robin") {
    attrs.round_robin_options = { iterations: f.playEachOther, ranking: challongeRanking(config) };
  }
  if (f.type === "swiss") {
    attrs.swiss_options = {
      rounds: f.rounds,
      pts_for_match_win: f.matchWinPoints,
      pts_for_match_tie: f.matchTiePoints,
    };
  }

  if (config.pools) {
    attrs.group_stage_enabled = true;
    attrs.group_stage_options = {
      stage_type: "round robin",
      group_size: config.pools.size,
      participant_count_to_advance_per_group: config.pools.advance,
      rr_iterations: config.pools.playEachOther,
      ranked_by: challongeRanking(config),
    };
  }

  return attrs;
}
