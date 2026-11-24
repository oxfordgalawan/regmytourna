ALTER TABLE public.registration_players
  ADD COLUMN IF NOT EXISTS guest_phone TEXT;