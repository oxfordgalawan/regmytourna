import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_GAMES_TO_WIN,
  gamesToWinFromDivisionConfig,
  parseBracketConfig,
} from "@/lib/bracket-format";

type TournamentScoringConfig = { games_to_win?: number };

/** Games to win for a match: category format, then event default, then 2. */
export async function gamesToWinForMatch(admin: SupabaseClient, matchId: string): Promise<number> {
  const { data: match } = await admin
    .from("matches")
    .select("division_id, tournament_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return DEFAULT_GAMES_TO_WIN;

  if (match.division_id) {
    const { data: division } = await admin
      .from("tournament_divisions")
      .select("bracket_config, capacity")
      .eq("id", match.division_id)
      .maybeSingle();
    if (division) {
      const config = parseBracketConfig(division.bracket_config, division.capacity ?? 16);
      return gamesToWinFromDivisionConfig(config);
    }
  }

  const { data: tournament } = await admin
    .from("tournaments")
    .select("scoring_config")
    .eq("id", match.tournament_id)
    .maybeSingle();
  const fromEvent = Number((tournament?.scoring_config as TournamentScoringConfig | null)?.games_to_win);
  if (fromEvent >= 1 && fromEvent <= 3) return fromEvent;
  return DEFAULT_GAMES_TO_WIN;
}
