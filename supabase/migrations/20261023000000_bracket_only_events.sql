-- Bracket-only events: the organizer imports the player list; no registration page, no payments.

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS registration_mode TEXT NOT NULL DEFAULT 'open'
    CHECK (registration_mode IN ('open', 'bracket_only'));

-- imported entries are told apart from desk walk-ins
ALTER TABLE public.registrations
  DROP CONSTRAINT IF EXISTS registrations_entry_source_check;
ALTER TABLE public.registrations
  ADD CONSTRAINT registrations_entry_source_check
    CHECK (entry_source IN ('online', 'pay_at_venue', 'desk', 'import'));
