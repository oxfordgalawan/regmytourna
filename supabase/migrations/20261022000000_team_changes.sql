-- Team changes by players: leave the team, find a substitute, cancel.

-- set when a player leaves and the one who stays hasn't picked a new partner yet
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS needs_partner_since TIMESTAMPTZ;

-- "take my place" invites: the leaving player stays on the team until the substitute accepts
CREATE TABLE IF NOT EXISTS public.entry_substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  leaving_row_id UUID NOT NULL REFERENCES public.registration_players(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  substitute_name TEXT NOT NULL,
  substitute_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

-- one open request per entry
CREATE UNIQUE INDEX IF NOT EXISTS entry_substitutions_one_pending
  ON public.entry_substitutions (registration_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS entry_substitutions_registration_idx
  ON public.entry_substitutions (registration_id);

-- server-only (service role); players reach it through server actions
ALTER TABLE public.entry_substitutions ENABLE ROW LEVEL SECURITY;
