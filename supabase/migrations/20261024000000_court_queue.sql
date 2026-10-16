-- One event-wide match queue, per court. A match is "queued" when it has a
-- court and is still scheduled; court_queue_position is its place in line.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS court_queue_position INTEGER;

CREATE INDEX IF NOT EXISTS matches_court_queue_idx
  ON public.matches (court_id, court_queue_position)
  WHERE court_id IS NOT NULL;

-- Umpires are removed softly so they can be restored.
ALTER TABLE public.tournament_umpires
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
