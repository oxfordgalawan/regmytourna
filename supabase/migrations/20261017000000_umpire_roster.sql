-- Named umpires with individual PINs, match assignment, queue order, pool defaults.

CREATE TABLE IF NOT EXISTS public.tournament_umpires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tournament_umpires_tournament_idx
  ON public.tournament_umpires(tournament_id);

CREATE TRIGGER tournament_umpires_updated_at
  BEFORE UPDATE ON public.tournament_umpires
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tournament_umpires ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS assigned_umpire_id UUID REFERENCES public.tournament_umpires(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS umpire_queue_order INTEGER;

CREATE INDEX IF NOT EXISTS matches_assigned_umpire_idx ON public.matches(assigned_umpire_id);
CREATE INDEX IF NOT EXISTS matches_umpire_queue_idx ON public.matches(tournament_id, umpire_queue_order);

CREATE TABLE IF NOT EXISTS public.umpire_pool_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES public.tournament_divisions(id) ON DELETE CASCADE,
  pool TEXT NOT NULL,
  umpire_id UUID NOT NULL REFERENCES public.tournament_umpires(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (division_id, pool)
);

CREATE INDEX IF NOT EXISTS umpire_pool_assignments_tournament_idx
  ON public.umpire_pool_assignments(tournament_id);

ALTER TABLE public.umpire_pool_assignments ENABLE ROW LEVEL SECURITY;
