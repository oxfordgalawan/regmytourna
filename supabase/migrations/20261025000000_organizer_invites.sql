-- Co-organizer invites: by email, or a shareable link the owner can turn off.
-- Accepting adds a row to tournament_organizers (role 'admin').

CREATE TABLE IF NOT EXISTS public.organizer_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('email', 'link')),
  email TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CHECK (kind = 'link' OR email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS organizer_invites_tournament_idx ON public.organizer_invites (tournament_id);
CREATE INDEX IF NOT EXISTS organizer_invites_email_idx ON public.organizer_invites (lower(email)) WHERE email IS NOT NULL;

-- one live share link per event
CREATE UNIQUE INDEX IF NOT EXISTS organizer_invites_one_link
  ON public.organizer_invites (tournament_id)
  WHERE kind = 'link' AND status = 'pending';

-- one open email invite per address per event
CREATE UNIQUE INDEX IF NOT EXISTS organizer_invites_one_email
  ON public.organizer_invites (tournament_id, lower(email))
  WHERE kind = 'email' AND status = 'pending';

-- server-only (service role)
ALTER TABLE public.organizer_invites ENABLE ROW LEVEL SECURITY;
