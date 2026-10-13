-- Per-category bracket formats + Challonge brackets, and umpire PIN access.

-- 1. Each category (tournament_divisions row) owns its own format and Challonge bracket.
ALTER TABLE public.tournament_divisions
  ADD COLUMN IF NOT EXISTS bracket_config JSONB,
  ADD COLUMN IF NOT EXISTS challonge_tournament_id TEXT,
  ADD COLUMN IF NOT EXISTS challonge_url TEXT,
  ADD COLUMN IF NOT EXISTS challonge_state TEXT,
  ADD COLUMN IF NOT EXISTS challonge_sync_status public.sync_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS challonge_last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tournament_divisions_challonge_idx
  ON public.tournament_divisions(challonge_tournament_id);

-- 2. Umpires score via a shared link + PIN (no account).
--    Kept out of `tournaments` (which is publicly readable): a short PIN's hash
--    could be brute-forced offline. RLS is on with NO policies, so only the
--    service role (server code) can read or write this table.
--    Bumping access_version invalidates every issued umpire session.
CREATE TABLE IF NOT EXISTS public.tournament_umpire_access (
  tournament_id UUID PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  pin_hash TEXT,
  access_version INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tournament_umpire_access ENABLE ROW LEVEL SECURITY;

-- 3. Score events from umpires have no profile; label who entered them.
ALTER TABLE public.match_scores
  ADD COLUMN IF NOT EXISTS operator_label TEXT;

-- 4. Remember which Challonge participants a match is between, so results can be reported.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS challonge_player1_id TEXT,
  ADD COLUMN IF NOT EXISTS challonge_player2_id TEXT;
