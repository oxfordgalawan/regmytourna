ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS waitlist_max INTEGER;

ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_waitlist_max_check;

ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_waitlist_max_check
  CHECK (waitlist_max IS NULL OR waitlist_max >= 1);

COMMENT ON COLUMN public.tournaments.waitlist_max IS
  'When waitlist is enabled, max waitlisted entries per division; NULL means unlimited.';