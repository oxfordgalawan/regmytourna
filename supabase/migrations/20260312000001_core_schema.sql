-- RegMyTourna core schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE public.account_type AS ENUM ('player', 'organizer');
CREATE TYPE public.tournament_status AS ENUM (
  'draft', 'published', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled'
);
CREATE TYPE public.division_format AS ENUM ('singles', 'doubles', 'team');
CREATE TYPE public.registration_status AS ENUM (
  'pending', 'awaiting_partner', 'awaiting_payment', 'confirmed', 'waitlisted', 'cancelled', 'refunded'
);
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'cancelled', 'refunded');
CREATE TYPE public.partner_invite_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
CREATE TYPE public.match_status AS ENUM ('scheduled', 'in_progress', 'completed', 'walkover', 'cancelled');
CREATE TYPE public.sync_status AS ENUM ('pending', 'synced', 'failed', 'skipped');
CREATE TYPE public.sync_job_status AS ENUM ('queued', 'running', 'completed', 'failed');
CREATE TYPE public.organizer_role AS ENUM ('owner', 'admin');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  account_type public.account_type NOT NULL DEFAULT 'player',
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, account_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'account_type')::public.account_type, 'player')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- OAuth CSRF state (Challonge)
CREATE TABLE public.oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'challonge',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX oauth_states_user_id_idx ON public.oauth_states(user_id);
CREATE INDEX oauth_states_expires_at_idx ON public.oauth_states(expires_at);

-- Challonge connections
CREATE TABLE public.challonge_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  challonge_user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER challonge_accounts_updated_at BEFORE UPDATE ON public.challonge_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tournaments
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sport TEXT NOT NULL DEFAULT 'pickleball',
  status public.tournament_status NOT NULL DEFAULT 'draft',
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  start_date DATE,
  end_date DATE,
  registration_opens_at TIMESTAMPTZ,
  registration_closes_at TIMESTAMPTZ,
  venue_name TEXT,
  venue_address TEXT,
  city TEXT,
  region TEXT,
  country TEXT DEFAULT 'PH',
  max_capacity INTEGER,
  entry_fee_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PHP',
  rules TEXT,
  cover_image_url TEXT,
  scoring_config JSONB NOT NULL DEFAULT '{"games_to_win": 2, "points_per_game": 11, "win_by_two": true}'::jsonb,
  waitlist_enabled BOOLEAN NOT NULL DEFAULT false,
  challonge_tournament_id TEXT,
  challonge_url TEXT,
  challonge_sync_status public.sync_status DEFAULT 'pending',
  challonge_last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tournaments_status_idx ON public.tournaments(status);
CREATE INDEX tournaments_start_date_idx ON public.tournaments(start_date);
CREATE INDEX tournaments_sport_idx ON public.tournaments(sport);
CREATE INDEX tournaments_city_idx ON public.tournaments(city);

CREATE TRIGGER tournaments_updated_at BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tournament_organizers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.organizer_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

CREATE TABLE public.tournament_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  format public.division_format NOT NULL DEFAULT 'singles',
  capacity INTEGER,
  entry_fee_cents INTEGER,
  registration_closes_at TIMESTAMPTZ,
  eligibility_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, name)
);

CREATE TRIGGER tournament_divisions_updated_at BEFORE UPDATE ON public.tournament_divisions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES public.tournament_divisions(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES public.tournament_divisions(id) ON DELETE RESTRICT,
  registered_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  status public.registration_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  waitlist_position INTEGER,
  challonge_participant_id TEXT,
  challonge_sync_status public.sync_status DEFAULT 'pending',
  challonge_sync_error TEXT,
  challonge_last_synced_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX registrations_tournament_idx ON public.registrations(tournament_id);
CREATE INDEX registrations_registered_by_idx ON public.registrations(registered_by);
CREATE INDEX registrations_division_idx ON public.registrations(division_id);

CREATE TRIGGER registrations_updated_at BEFORE UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.registration_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  partner_invite_status public.partner_invite_status,
  partner_invite_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  status public.payment_status NOT NULL DEFAULT 'pending',
  paymongo_checkout_session_id TEXT,
  paymongo_payment_intent_id TEXT,
  paymongo_payment_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_registration_idx ON public.payments(registration_id);
CREATE INDEX payments_user_idx ON public.payments(user_id);

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, name)
);

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  division_id UUID REFERENCES public.tournament_divisions(id) ON DELETE SET NULL,
  court_id UUID REFERENCES public.courts(id) ON DELETE SET NULL,
  match_number INTEGER,
  round_label TEXT,
  team_a_label TEXT NOT NULL,
  team_b_label TEXT NOT NULL,
  team_a_registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  team_b_registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  status public.match_status NOT NULL DEFAULT 'scheduled',
  current_game INTEGER NOT NULL DEFAULT 1,
  score_a INTEGER NOT NULL DEFAULT 0,
  score_b INTEGER NOT NULL DEFAULT 0,
  games_won_a INTEGER NOT NULL DEFAULT 0,
  games_won_b INTEGER NOT NULL DEFAULT 0,
  challonge_match_id TEXT,
  challonge_result_submitted_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX matches_tournament_idx ON public.matches(tournament_id);
CREATE INDEX matches_court_idx ON public.matches(court_id);

CREATE TRIGGER matches_updated_at BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  game_number INTEGER NOT NULL,
  score_a INTEGER NOT NULL,
  score_b INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  checked_in_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, registration_id)
);

CREATE TABLE public.integration_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL,
  status public.sync_job_status NOT NULL DEFAULT 'queued',
  payload JSONB,
  error_message TEXT,
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER integration_sync_jobs_updated_at BEFORE UPDATE ON public.integration_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_actor_idx ON public.audit_logs(actor_id);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs(entity_type, entity_id);

-- Helper: is tournament organizer
CREATE OR REPLACE FUNCTION public.is_tournament_organizer(p_tournament_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_organizers
    WHERE tournament_id = p_tournament_id AND user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE id = p_tournament_id AND owner_id = p_user_id
  );
$$;

-- Public display view (no PII)
CREATE OR REPLACE VIEW public.tournament_display_public
WITH (security_invoker = true)
AS
SELECT
  t.id AS tournament_id,
  t.name AS tournament_name,
  t.slug,
  c.id AS court_id,
  c.name AS court_name,
  m.id AS match_id,
  m.match_number,
  m.round_label,
  m.team_a_label,
  m.team_b_label,
  m.status,
  m.current_game,
  m.score_a,
  m.score_b,
  m.games_won_a,
  m.games_won_b,
  m.scheduled_at,
  d.name AS division_name
FROM public.tournaments t
LEFT JOIN public.matches m ON m.tournament_id = t.id
LEFT JOIN public.courts c ON c.id = m.court_id
LEFT JOIN public.tournament_divisions d ON d.id = m.division_id
WHERE t.is_public = true
  AND t.status IN ('published', 'registration_open', 'registration_closed', 'in_progress', 'completed');

GRANT SELECT ON public.tournament_display_public TO anon, authenticated;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challonge_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_select_public_organizers ON public.profiles FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.owner_id = profiles.id AND t.is_public = true
        AND t.status IN ('published', 'registration_open', 'registration_closed', 'in_progress', 'completed')
    )
  );

-- OAuth states: no direct client access (service role only)
CREATE POLICY oauth_states_deny_all ON public.oauth_states FOR ALL TO authenticated USING (false);

-- Challonge accounts
CREATE POLICY challonge_select_own ON public.challonge_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND disconnected_at IS NULL);

-- Tournaments public read
CREATE POLICY tournaments_public_select ON public.tournaments FOR SELECT TO anon, authenticated
  USING (
    is_public = true AND status IN ('published', 'registration_open', 'registration_closed', 'in_progress', 'completed')
  );
CREATE POLICY tournaments_organizer_select ON public.tournaments FOR SELECT TO authenticated
  USING (public.is_tournament_organizer(id, auth.uid()));
CREATE POLICY tournaments_organizer_insert ON public.tournaments FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY tournaments_organizer_update ON public.tournaments FOR UPDATE TO authenticated
  USING (public.is_tournament_organizer(id, auth.uid()))
  WITH CHECK (public.is_tournament_organizer(id, auth.uid()));
CREATE POLICY tournaments_organizer_delete ON public.tournaments FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Tournament organizers
CREATE POLICY tournament_organizers_select ON public.tournament_organizers FOR SELECT TO authenticated
  USING (public.is_tournament_organizer(tournament_id, auth.uid()));
CREATE POLICY tournament_organizers_manage ON public.tournament_organizers FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.owner_id = auth.uid())
  );

-- Divisions
CREATE POLICY divisions_public_select ON public.tournament_divisions FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.is_public = true
        AND t.status IN ('published', 'registration_open', 'registration_closed', 'in_progress', 'completed')
    )
  );
CREATE POLICY divisions_organizer_all ON public.tournament_divisions FOR ALL TO authenticated
  USING (public.is_tournament_organizer(tournament_id, auth.uid()))
  WITH CHECK (public.is_tournament_organizer(tournament_id, auth.uid()));

-- Registrations
CREATE POLICY registrations_select_own ON public.registrations FOR SELECT TO authenticated
  USING (
    registered_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.registration_players rp WHERE rp.registration_id = registrations.id AND rp.user_id = auth.uid())
    OR public.is_tournament_organizer(tournament_id, auth.uid())
  );
CREATE POLICY registrations_insert_own ON public.registrations FOR INSERT TO authenticated
  WITH CHECK (registered_by = auth.uid());
CREATE POLICY registrations_update_own ON public.registrations FOR UPDATE TO authenticated
  USING (
    registered_by = auth.uid() OR public.is_tournament_organizer(tournament_id, auth.uid())
  );
CREATE POLICY registrations_organizer_update ON public.registrations FOR UPDATE TO authenticated
  USING (public.is_tournament_organizer(tournament_id, auth.uid()));

-- Registration players
CREATE POLICY registration_players_select ON public.registration_players FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.id = registration_id AND (r.registered_by = auth.uid() OR public.is_tournament_organizer(r.tournament_id, auth.uid()))
    )
  );
CREATE POLICY registration_players_insert ON public.registration_players FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.registrations r WHERE r.id = registration_id AND r.registered_by = auth.uid())
  );

-- Payments: read own; no user updates
CREATE POLICY payments_select_own ON public.payments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.id = registration_id AND public.is_tournament_organizer(r.tournament_id, auth.uid())
    )
  );

CREATE POLICY payment_webhook_events_deny ON public.payment_webhook_events FOR ALL TO authenticated USING (false);

-- Courts & matches public for display when tournament public
CREATE POLICY courts_public_select ON public.courts FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.is_public = true
        AND t.status IN ('published', 'registration_open', 'registration_closed', 'in_progress', 'completed')
    )
  );
CREATE POLICY courts_organizer_all ON public.courts FOR ALL TO authenticated
  USING (public.is_tournament_organizer(tournament_id, auth.uid()))
  WITH CHECK (public.is_tournament_organizer(tournament_id, auth.uid()));

CREATE POLICY matches_public_select ON public.matches FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.is_public = true
        AND t.status IN ('published', 'registration_open', 'registration_closed', 'in_progress', 'completed')
    )
  );
CREATE POLICY matches_organizer_all ON public.matches FOR ALL TO authenticated
  USING (public.is_tournament_organizer(tournament_id, auth.uid()))
  WITH CHECK (public.is_tournament_organizer(tournament_id, auth.uid()));

CREATE POLICY match_scores_organizer ON public.match_scores FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND public.is_tournament_organizer(m.tournament_id, auth.uid())
    )
  );
CREATE POLICY match_scores_public_select ON public.match_scores FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.tournaments t ON t.id = m.tournament_id
      WHERE m.id = match_id AND t.is_public = true
        AND t.status IN ('in_progress', 'completed')
    )
  );

CREATE POLICY check_ins_organizer ON public.check_ins FOR ALL TO authenticated
  USING (public.is_tournament_organizer(tournament_id, auth.uid()))
  WITH CHECK (public.is_tournament_organizer(tournament_id, auth.uid()));

CREATE POLICY teams_division_access ON public.teams FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournament_divisions d
      WHERE d.id = division_id AND public.is_tournament_organizer(d.tournament_id, auth.uid())
    )
  );
CREATE POLICY team_members_access ON public.team_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams tm
      JOIN public.tournament_divisions d ON d.id = tm.division_id
      WHERE tm.id = team_id AND (team_members.user_id = auth.uid() OR public.is_tournament_organizer(d.tournament_id, auth.uid()))
    )
  );

CREATE POLICY sync_jobs_organizer ON public.integration_sync_jobs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (tournament_id IS NOT NULL AND public.is_tournament_organizer(tournament_id, auth.uid()))
  );

CREATE POLICY audit_logs_deny ON public.audit_logs FOR ALL TO authenticated USING (false);
