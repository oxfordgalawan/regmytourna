export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challonge_accounts: {
        Row: {
          access_token_encrypted: string
          challonge_user_id: string
          connected_at: string
          created_at: string
          disconnected_at: string | null
          id: string
          refresh_token_encrypted: string | null
          scopes: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          access_token_encrypted: string
          challonge_user_id: string
          connected_at?: string
          created_at?: string
          disconnected_at?: string | null
          id?: string
          refresh_token_encrypted?: string | null
          scopes?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          access_token_encrypted?: string
          challonge_user_id?: string
          connected_at?: string
          created_at?: string
          disconnected_at?: string | null
          id?: string
          refresh_token_encrypted?: string | null
          scopes?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "challonge_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          checked_in_at: string
          checked_in_by: string | null
          id: string
          registration_id: string
          tournament_id: string
        }
        Insert: {
          checked_in_at?: string
          checked_in_by?: string | null
          id?: string
          registration_id: string
          tournament_id: string
        }
        Update: {
          checked_in_at?: string
          checked_in_by?: string | null
          id?: string
          registration_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_display_public"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "check_ins_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courts_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_display_public"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "courts_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          last_success_at: string | null
          payload: Json | null
          status: Database["public"]["Enums"]["sync_job_status"]
          tournament_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          last_success_at?: string | null
          payload?: Json | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          tournament_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          last_success_at?: string | null
          payload?: Json | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          tournament_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_jobs_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_display_public"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "integration_sync_jobs_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_scores: {
        Row: {
          action_type: string
          created_at: string
          game_number: number
          id: string
          match_id: string
          operator_id: string | null
          score_a: number
          score_b: number
        }
        Insert: {
          action_type: string
          created_at?: string
          game_number: number
          id?: string
          match_id: string
          operator_id?: string | null
          score_a: number
          score_b: number
        }
        Update: {
          action_type?: string
          created_at?: string
          game_number?: number
          id?: string
          match_id?: string
          operator_id?: string | null
          score_a?: number
          score_b?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_scores_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_scores_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_display_public"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_scores_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          challonge_match_id: string | null
          challonge_result_submitted_at: string | null
          completed_at: string | null
          court_id: string | null
          created_at: string
          current_game: number
          division_id: string | null
          games_won_a: number
          games_won_b: number
          id: string
          match_number: number | null
          round_label: string | null
          scheduled_at: string | null
          score_a: number
          score_b: number
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          team_a_label: string
          team_a_registration_id: string | null
          team_b_label: string
          team_b_registration_id: string | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          challonge_match_id?: string | null
          challonge_result_submitted_at?: string | null
          completed_at?: string | null
          court_id?: string | null
          created_at?: string
          current_game?: number
          division_id?: string | null
          games_won_a?: number
          games_won_b?: number
          id?: string
          match_number?: number | null
          round_label?: string | null
          scheduled_at?: string | null
          score_a?: number
          score_b?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          team_a_label: string
          team_a_registration_id?: string | null
          team_b_label: string
          team_b_registration_id?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          challonge_match_id?: string | null
          challonge_result_submitted_at?: string | null
          completed_at?: string | null
          court_id?: string | null
          created_at?: string
          current_game?: number
          division_id?: string | null
          games_won_a?: number
          games_won_b?: number
          id?: string
          match_number?: number | null
          round_label?: string | null
          scheduled_at?: string | null
          score_a?: number
          score_b?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          team_a_label?: string
          team_a_registration_id?: string | null
          team_b_label?: string
          team_b_registration_id?: string | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "tournament_display_public"
            referencedColumns: ["court_id"]
          },
          {
            foreignKeyName: "matches_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "tournament_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_a_registration_id_fkey"
            columns: ["team_a_registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_registration_id_fkey"
            columns: ["team_b_registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_display_public"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          provider: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          provider?: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          provider?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_payout_methods: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string
          method_type: Database["public"]["Enums"]["payout_method_type"]
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          method_type: Database["public"]["Enums"]["payout_method_type"]
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          method_type?: Database["public"]["Enums"]["payout_method_type"]
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_payout_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_wallets: {
        Row: {
          available_balance_cents: number
          created_at: string
          currency: string
          pending_withdrawal_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance_cents?: number
          created_at?: string
          currency?: string
          pending_withdrawal_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance_cents?: number
          created_at?: string
          currency?: string
          pending_withdrawal_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          event_type: string
          external_event_id: string
          id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          external_event_id: string
          id?: string
          payload: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          external_event_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          credited_to_user_id: string | null
          currency: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          organizer_net_cents: number | null
          paid_at: string | null
          paymongo_checkout_session_id: string | null
          paymongo_payment_id: string | null
          paymongo_payment_intent_id: string | null
          platform_fee_cents: number | null
          registration_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credited_to_user_id?: string | null
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          organizer_net_cents?: number | null
          paid_at?: string | null
          paymongo_checkout_session_id?: string | null
          paymongo_payment_id?: string | null
          paymongo_payment_intent_id?: string | null
          platform_fee_cents?: number | null
          registration_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credited_to_user_id?: string | null
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          organizer_net_cents?: number | null
          paid_at?: string | null
          paymongo_checkout_session_id?: string | null
          paymongo_payment_id?: string | null
          paymongo_payment_intent_id?: string | null
          platform_fee_cents?: number | null
          registration_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_credited_to_user_id_fkey"
            columns: ["credited_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ph_places: {
        Row: {
          barangay_code: string | null
          barangay_name: string | null
          city_municipality_code: string
          city_municipality_name: string
          display_label: string
          level: Database["public"]["Enums"]["ph_place_level"]
          name: string
          province_code: string | null
          province_name: string | null
          psgc_code: string
          region_code: string
          region_name: string
          search_text: string
        }
        Insert: {
          barangay_code?: string | null
          barangay_name?: string | null
          city_municipality_code: string
          city_municipality_name: string
          display_label: string
          level: Database["public"]["Enums"]["ph_place_level"]
          name: string
          province_code?: string | null
          province_name?: string | null
          psgc_code: string
          region_code: string
          region_name: string
          search_text: string
        }
        Update: {
          barangay_code?: string | null
          barangay_name?: string | null
          city_municipality_code?: string
          city_municipality_name?: string
          display_label?: string
          level?: Database["public"]["Enums"]["ph_place_level"]
          name?: string
          province_code?: string | null
          province_name?: string | null
          psgc_code?: string
          region_code?: string
          region_name?: string
          search_text?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          place_label: string | null
          place_psgc_code: string | null
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          place_label?: string | null
          place_psgc_code?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          place_label?: string | null
          place_psgc_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_place_psgc_code_fkey"
            columns: ["place_psgc_code"]
            isOneToOne: false
            referencedRelation: "ph_places"
            referencedColumns: ["psgc_code"]
          },
        ]
      }
      registration_players: {
        Row: {
          created_at: string
          guest_email: string | null
          guest_name: string | null
          id: string
          is_primary: boolean
          partner_invite_status:
            | Database["public"]["Enums"]["partner_invite_status"]
            | null
          partner_invite_token: string | null
          registration_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          is_primary?: boolean
          partner_invite_status?:
            | Database["public"]["Enums"]["partner_invite_status"]
            | null
          partner_invite_token?: string | null
          registration_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          is_primary?: boolean
          partner_invite_status?:
            | Database["public"]["Enums"]["partner_invite_status"]
            | null
          partner_invite_token?: string | null
          registration_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_players_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          challonge_last_synced_at: string | null
          challonge_participant_id: string | null
          challonge_sync_error: string | null
          challonge_sync_status:
            | Database["public"]["Enums"]["sync_status"]
            | null
          created_at: string
          division_id: string
          id: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          registered_by: string
          status: Database["public"]["Enums"]["registration_status"]
          team_id: string | null
          tournament_id: string
          updated_at: string
          waitlist_position: number | null
        }
        Insert: {
          challonge_last_synced_at?: string | null
          challonge_participant_id?: string | null
          challonge_sync_error?: string | null
          challonge_sync_status?:
            | Database["public"]["Enums"]["sync_status"]
            | null
          created_at?: string
          division_id: string
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          registered_by: string
          status?: Database["public"]["Enums"]["registration_status"]
          team_id?: string | null
          tournament_id: string
          updated_at?: string
          waitlist_position?: number | null
        }
        Update: {
          challonge_last_synced_at?: string | null
          challonge_participant_id?: string | null
          challonge_sync_error?: string | null
          challonge_sync_status?:
            | Database["public"]["Enums"]["sync_status"]
            | null
          created_at?: string
          division_id?: string
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          registered_by?: string
          status?: Database["public"]["Enums"]["registration_status"]
          team_id?: string | null
          tournament_id?: string
          updated_at?: string
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "tournament_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_display_public"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          division_id: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          division_id: string
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          division_id?: string
          id?: string
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "tournament_divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_divisions: {
        Row: {
          capacity: number | null
          created_at: string
          eligibility_notes: string | null
          entry_fee_cents: number | null
          format: Database["public"]["Enums"]["division_format"]
          id: string
          name: string
          registration_closes_at: string | null
          sort_order: number
          tournament_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          eligibility_notes?: string | null
          entry_fee_cents?: number | null
          format?: Database["public"]["Enums"]["division_format"]
          id?: string
          name: string
          registration_closes_at?: string | null
          sort_order?: number
          tournament_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          eligibility_notes?: string | null
          entry_fee_cents?: number | null
          format?: Database["public"]["Enums"]["division_format"]
          id?: string
          name?: string
          registration_closes_at?: string | null
          sort_order?: number
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_divisions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_display_public"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_divisions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_organizers: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["organizer_role"]
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["organizer_role"]
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["organizer_role"]
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_organizers_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_display_public"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_organizers_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_organizers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          challonge_last_synced_at: string | null
          challonge_sync_status:
            | Database["public"]["Enums"]["sync_status"]
            | null
          challonge_tournament_id: string | null
          challonge_url: string | null
          city: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          currency: string
          description: string | null
          end_date: string | null
          entry_fee_cents: number
          id: string
          is_demo: boolean
          is_public: boolean
          max_capacity: number | null
          name: string
          owner_id: string
          region: string | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          rules: string | null
          scoring_config: Json
          slug: string
          sport: string
          start_date: string | null
          status: Database["public"]["Enums"]["tournament_status"]
          updated_at: string
          venue_address: string | null
          venue_name: string | null
          waitlist_enabled: boolean
        }
        Insert: {
          challonge_last_synced_at?: string | null
          challonge_sync_status?:
            | Database["public"]["Enums"]["sync_status"]
            | null
          challonge_tournament_id?: string | null
          challonge_url?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          entry_fee_cents?: number
          id?: string
          is_demo?: boolean
          is_public?: boolean
          max_capacity?: number | null
          name: string
          owner_id: string
          region?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          rules?: string | null
          scoring_config?: Json
          slug: string
          sport?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          waitlist_enabled?: boolean
        }
        Update: {
          challonge_last_synced_at?: string | null
          challonge_sync_status?:
            | Database["public"]["Enums"]["sync_status"]
            | null
          challonge_tournament_id?: string | null
          challonge_url?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          entry_fee_cents?: number
          id?: string
          is_demo?: boolean
          is_public?: boolean
          max_capacity?: number | null
          name?: string
          owner_id?: string
          region?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          rules?: string | null
          scoring_config?: Json
          slug?: string
          sport?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          waitlist_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount_cents: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          payment_id: string | null
          registration_id: string | null
          tournament_id: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_user_id: string
          withdrawal_request_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          registration_id?: string | null
          tournament_id?: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_user_id: string
          withdrawal_request_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          registration_id?: string | null
          tournament_id?: string | null
          type?: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_user_id?: string
          withdrawal_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_display_public"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "wallet_transactions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_user_id_fkey"
            columns: ["wallet_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount_cents: number
          created_at: string
          currency: string
          id: string
          payout_method_id: string | null
          payout_snapshot: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          payout_method_id?: string | null
          payout_snapshot: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          payout_method_id?: string | null
          payout_snapshot?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_payout_method_id_fkey"
            columns: ["payout_method_id"]
            isOneToOne: false
            referencedRelation: "organizer_payout_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      tournament_display_public: {
        Row: {
          court_id: string | null
          court_name: string | null
          current_game: number | null
          division_name: string | null
          games_won_a: number | null
          games_won_b: number | null
          match_id: string | null
          match_number: number | null
          round_label: string | null
          scheduled_at: string | null
          score_a: number | null
          score_b: number | null
          slug: string | null
          status: Database["public"]["Enums"]["match_status"] | null
          team_a_label: string | null
          team_b_label: string | null
          tournament_id: string | null
          tournament_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      credit_organizer_wallet: {
        Args: {
          p_description?: string
          p_gross_cents: number
          p_organizer_net_cents: number
          p_payment_id: string
          p_platform_fee_cents: number
          p_registration_id: string
          p_tournament_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      is_tournament_organizer: {
        Args: { p_tournament_id: string; p_user_id: string }
        Returns: boolean
      }
      request_wallet_withdrawal: {
        Args: {
          p_amount_cents: number
          p_min_amount_cents?: number
          p_payout_method_id: string
          p_user_id: string
        }
        Returns: string
      }
      review_wallet_withdrawal: {
        Args: {
          p_action: string
          p_admin_user_id: string
          p_note?: string
          p_request_id: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      account_type: "player" | "organizer"
      division_format: "singles" | "doubles" | "team"
      match_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "walkover"
        | "cancelled"
      organizer_role: "owner" | "admin"
      partner_invite_status: "pending" | "accepted" | "declined" | "expired"
      payment_status: "pending" | "paid" | "failed" | "cancelled" | "refunded"
      payout_method_type: "gcash" | "maya" | "bank" | "other"
      ph_place_level: "city_municipality" | "barangay"
      registration_status:
        | "pending"
        | "awaiting_partner"
        | "awaiting_payment"
        | "confirmed"
        | "waitlisted"
        | "cancelled"
        | "refunded"
      sync_job_status: "queued" | "running" | "completed" | "failed"
      sync_status: "pending" | "synced" | "failed" | "skipped"
      tournament_status:
        | "draft"
        | "published"
        | "registration_open"
        | "registration_closed"
        | "in_progress"
        | "completed"
        | "cancelled"
      wallet_transaction_type:
        | "entry_payment"
        | "platform_fee"
        | "refund"
        | "payout"
        | "adjustment"
      withdrawal_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["player", "organizer"],
      division_format: ["singles", "doubles", "team"],
      match_status: [
        "scheduled",
        "in_progress",
        "completed",
        "walkover",
        "cancelled",
      ],
      organizer_role: ["owner", "admin"],
      partner_invite_status: ["pending", "accepted", "declined", "expired"],
      payment_status: ["pending", "paid", "failed", "cancelled", "refunded"],
      payout_method_type: ["gcash", "maya", "bank", "other"],
      ph_place_level: ["city_municipality", "barangay"],
      registration_status: [
        "pending",
        "awaiting_partner",
        "awaiting_payment",
        "confirmed",
        "waitlisted",
        "cancelled",
        "refunded",
      ],
      sync_job_status: ["queued", "running", "completed", "failed"],
      sync_status: ["pending", "synced", "failed", "skipped"],
      tournament_status: [
        "draft",
        "published",
        "registration_open",
        "registration_closed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      wallet_transaction_type: [
        "entry_payment",
        "platform_fee",
        "refund",
        "payout",
        "adjustment",
      ],
      withdrawal_request_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
      ],
    },
  },
} as const
