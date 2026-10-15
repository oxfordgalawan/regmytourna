export type AccountType = "player" | "organizer";
export type TournamentStatus =
  | "draft"
  | "published"
  | "registration_open"
  | "registration_closed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Profile = {
  id: string;
  full_name: string;
  account_type: AccountType;
  avatar_url: string | null;
  phone: string | null;
  place_psgc_code: string | null;
  place_label: string | null;
  created_at: string;
  updated_at: string;
};

export type Tournament = {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  description: string | null;
  sport: string;
  status: TournamentStatus;
  is_public: boolean;
  is_demo: boolean;
  start_date: string | null;
  end_date: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  max_capacity: number | null;
  entry_fee_cents: number;
  currency: string;
  rules: string | null;
  cover_image_url: string | null;
  scoring_config: Record<string, unknown>;
  waitlist_enabled: boolean;
  challonge_tournament_id: string | null;
  challonge_url: string | null;
  challonge_sync_status: string | null;
  challonge_last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TournamentDivision = {
  id: string;
  tournament_id: string;
  name: string;
  format: "singles" | "doubles" | "team";
  capacity: number | null;
  entry_fee_cents: number | null;
  registration_closes_at: string | null;
  eligibility_notes: string | null;
  sort_order: number;
  bracket_config: Record<string, unknown> | null;
  challonge_tournament_id: string | null;
  challonge_url: string | null;
  challonge_state: string | null;
  challonge_sync_status: string | null;
  challonge_last_synced_at: string | null;
};

export type ChallongeAccount = {
  id: string;
  user_id: string;
  challonge_user_id: string;
  username: string;
  scopes: string | null;
  connected_at: string;
  disconnected_at: string | null;
};

export type Registration = {
  id: string;
  tournament_id: string;
  division_id: string;
  registered_by: string;
  team_id: string | null;
  status: string;
  payment_status: string;
  waitlist_position: number | null;
  challonge_participant_id: string | null;
  challonge_sync_status: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  registration_id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
};

export type TournamentUmpire = {
  id: string;
  tournament_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Match = {
  id: string;
  tournament_id: string;
  division_id: string | null;
  court_id: string | null;
  match_number: number | null;
  team_a_label: string;
  team_b_label: string;
  status: string;
  current_game: number;
  score_a: number;
  score_b: number;
  games_won_a: number;
  games_won_b: number;
  challonge_match_id: string | null;
  round_label?: string | null;
  team_a_registration_id?: string | null;
  team_b_registration_id?: string | null;
  challonge_player1_id?: string | null;
  challonge_player2_id?: string | null;
  assigned_umpire_id?: string | null;
  umpire_queue_order?: number | null;
  pool?: string | null;
  stage?: string | null;
  is_bye?: boolean;
  is_conditional?: boolean;
};
