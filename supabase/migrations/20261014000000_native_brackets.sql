-- RegMyTourna runs brackets natively: seeding, generated draws, auto-advancing winners.

-- 1. Seeding and withdrawals per entry.
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS seed INTEGER,
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;

-- 2. Where each category is in its life cycle.
--    not_started → pools → pools_done → final → complete (stages skipped per format)
ALTER TABLE public.tournament_divisions
  ADD COLUMN IF NOT EXISTS bracket_state TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS bracket_started_at TIMESTAMPTZ;

-- 3. Bracket structure on matches. next_* / loser_next_* point at the match the
--    winner / loser moves into, so advancing is a single update.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS stage TEXT,
  ADD COLUMN IF NOT EXISTS pool TEXT,
  ADD COLUMN IF NOT EXISTS round INTEGER,
  ADD COLUMN IF NOT EXISTS position INTEGER,
  ADD COLUMN IF NOT EXISTS next_match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_slot TEXT CHECK (next_slot IN ('a', 'b')),
  ADD COLUMN IF NOT EXISTS loser_next_match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loser_next_slot TEXT CHECK (loser_next_slot IN ('a', 'b')),
  ADD COLUMN IF NOT EXISTS winner_registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_bye BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_conditional BOOLEAN NOT NULL DEFAULT false,
  -- final score of each game, e.g. [[11,9],[7,11],[11,4]] (side A first); feeds standings
  ADD COLUMN IF NOT EXISTS game_scores JSONB;

CREATE INDEX IF NOT EXISTS matches_division_stage_idx ON public.matches(division_id, stage, round);
