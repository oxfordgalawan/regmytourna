-- Offline-first scoring: the umpire's device records actions as numbered ops
-- and syncs them later. client_seq is the last op the server has applied, and
-- client_op_id makes retried syncs idempotent.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS client_seq INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.match_scores
  ADD COLUMN IF NOT EXISTS client_op_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS match_scores_client_op_id_key ON public.match_scores (client_op_id);

ALTER TABLE public.match_events
  ADD COLUMN IF NOT EXISTS client_op_id TEXT,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS match_events_client_op_id_key ON public.match_events (client_op_id);
