-- Entry petitions with proof images in private storage.

CREATE TABLE IF NOT EXISTS public.entry_petitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES public.tournament_divisions(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 10),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_note TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS entry_petitions_one_pending_per_registration
  ON public.entry_petitions(registration_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS entry_petitions_tournament_idx ON public.entry_petitions(tournament_id);
CREATE INDEX IF NOT EXISTS entry_petitions_status_idx ON public.entry_petitions(tournament_id, status);

CREATE TABLE IF NOT EXISTS public.entry_petition_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  petition_id UUID NOT NULL REFERENCES public.entry_petitions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0 AND sort_order <= 2),
  content_type TEXT NOT NULL,
  byte_size INTEGER,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (petition_id, sort_order)
);

ALTER TABLE public.entry_petitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_petition_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY entry_petitions_select_own ON public.entry_petitions FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR public.is_tournament_organizer(tournament_id, auth.uid())
  );

CREATE POLICY entry_petition_images_select ON public.entry_petition_images FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.entry_petitions p
      WHERE p.id = petition_id
        AND (p.submitted_by = auth.uid() OR public.is_tournament_organizer(p.tournament_id, auth.uid()))
    )
  );

-- Inserts/updates via service role in server actions only (no client INSERT policies).

CREATE OR REPLACE FUNCTION public.user_owns_registration(p_registration_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.registrations r
    WHERE r.id = p_registration_id
      AND (
        r.registered_by = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.registration_players rp
          WHERE rp.registration_id = r.id AND rp.user_id = p_user_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_owns_registration(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_owns_registration(UUID, UUID) TO authenticated, service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('petition-proofs', 'petition-proofs', false, 2097152, ARRAY['image/webp', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY petition_proofs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'petition-proofs'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] IS NOT NULL
    AND public.user_owns_registration((storage.foldername(name))[2]::uuid, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.id = (storage.foldername(name))[2]::uuid
        AND r.tournament_id = (storage.foldername(name))[1]::uuid
    )
  );

CREATE POLICY petition_proofs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'petition-proofs'
    AND (
      public.user_owns_registration((storage.foldername(name))[2]::uuid, auth.uid())
      OR public.is_tournament_organizer((storage.foldername(name))[1]::uuid, auth.uid())
    )
  );
