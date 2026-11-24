import type { MatchSetup } from "@/lib/scoring/pickleball";
import type { ServeState } from "@/lib/scoring/pickleball";

export type QuickScorePlayerNames = { a: string[]; b: string[] };

export type QuickScoreSessionRow = {
  id: string;
  public_token: string;
  title: string | null;
  team_a_label: string;
  team_b_label: string;
  player_names: QuickScorePlayerNames;
  doubles: boolean;
  games_to_win: number;
  status: string;
  current_game: number;
  score_a: number;
  score_b: number;
  games_won_a: number;
  games_won_b: number;
  game_scores: Array<[number, number]> | null;
  serve_state: ServeState | null;
  match_setup: MatchSetup | null;
  client_seq: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};