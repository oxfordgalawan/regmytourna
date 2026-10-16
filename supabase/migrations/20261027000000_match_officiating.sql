-- Pickleball officiating: pre-match setup (toss, first serve, base players),
-- live serve tracking (server #1/#2, who stands where) and an officiating log
-- (timers run, game starts) kept as proof of what the umpire did.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS match_setup JSONB,
  ADD COLUMN IF NOT EXISTS serve_state JSONB;

-- state before each rally, so Undo restores the serve as well as the score
ALTER TABLE public.match_scores
  ADD COLUMN IF NOT EXISTS prev_state JSONB;

CREATE TABLE IF NOT EXISTS public.match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  operator_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS match_events_match_idx ON public.match_events (match_id, created_at);

-- written and read by the server only
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
