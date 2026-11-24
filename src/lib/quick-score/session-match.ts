import type { MatchSetup } from "@/lib/scoring/pickleball";
import type { ServeState } from "@/lib/scoring/pickleball";
import type { Match } from "@/types/database";
import type { QuickScoreSessionRow } from "@/lib/quick-score/types";

export type QuickScoreServerMatch = Match & {
  serve_state?: ServeState | null;
  match_setup?: MatchSetup | null;
  game_scores?: Array<[number, number]> | null;
  client_seq?: number | null;
};

export function sessionAsMatch(row: QuickScoreSessionRow): QuickScoreServerMatch {
  return {
    id: row.id,
    tournament_id: "00000000-0000-0000-0000-000000000000",
    division_id: null,
    court_id: null,
    match_number: null,
    round_label: row.title,
    team_a_label: row.team_a_label,
    team_b_label: row.team_b_label,
    team_a_registration_id: null,
    team_b_registration_id: null,
    status: row.status,
    current_game: row.current_game,
    score_a: row.score_a,
    score_b: row.score_b,
    games_won_a: row.games_won_a,
    games_won_b: row.games_won_b,
    challonge_match_id: null,
    serve_state: row.serve_state,
    match_setup: row.match_setup,
    game_scores: row.game_scores,
    client_seq: row.client_seq,
  };
}