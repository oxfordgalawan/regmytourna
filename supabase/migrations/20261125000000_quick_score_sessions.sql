-- Public umpire tool: token-scoped scoring sessions (no tournament link).

CREATE TABLE public.quick_score_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token TEXT NOT NULL UNIQUE,
  title TEXT,
  team_a_label TEXT NOT NULL,
  team_b_label TEXT NOT NULL,
  player_names JSONB NOT NULL DEFAULT '{"a":[],"b":[]}'::jsonb,
  doubles BOOLEAN NOT NULL DEFAULT true,
  games_to_win SMALLINT NOT NULL DEFAULT 2 CHECK (games_to_win IN (1, 2)),
  status public.match_status NOT NULL DEFAULT 'in_progress',
  current_game INTEGER NOT NULL DEFAULT 1,
  score_a INTEGER NOT NULL DEFAULT 0,
  score_b INTEGER NOT NULL DEFAULT 0,
  games_won_a INTEGER NOT NULL DEFAULT 0,
  games_won_b INTEGER NOT NULL DEFAULT 0,
  game_scores JSONB,
  serve_state JSONB,
  match_setup JSONB,
  client_seq INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX quick_score_sessions_token_idx ON public.quick_score_sessions (public_token);
CREATE INDEX quick_score_sessions_expires_idx ON public.quick_score_sessions (expires_at);

CREATE TRIGGER quick_score_sessions_updated_at
  BEFORE UPDATE ON public.quick_score_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Access only via service role (Next.js API / actions).
ALTER TABLE public.quick_score_sessions ENABLE ROW LEVEL SECURITY;