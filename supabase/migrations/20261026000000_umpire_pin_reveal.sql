-- Lets organizers reveal/copy an umpire's PIN: an encrypted copy next to the hash
-- (encrypted by the app with a server-side key; never readable by clients).
ALTER TABLE public.tournament_umpires
  ADD COLUMN IF NOT EXISTS pin_encrypted TEXT;
