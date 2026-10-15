-- Allow organizers to disable courts they are not using for this event.
ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS courts_tournament_active_idx ON public.courts(tournament_id, active);
