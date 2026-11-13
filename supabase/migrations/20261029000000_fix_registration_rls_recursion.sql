-- Fix "infinite recursion detected in policy" (42P17) between registrations
-- and registration_players. Each table's SELECT policy queried the other, so
-- any signed-in query touching them failed — including every storage upload,
-- because Postgres expands all storage.objects INSERT policies (the
-- petition-proofs one reads registrations). Storage reported it as
-- "The database schema is invalid or incompatible", breaking profile photos,
-- tournament covers and petition proofs.
--
-- The cross-table checks now live in SECURITY DEFINER helpers, which read the
-- other table without re-applying its RLS.

CREATE OR REPLACE FUNCTION public.user_plays_in_registration(p_registration_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.registration_players rp
    WHERE rp.registration_id = p_registration_id AND rp.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_registration(p_registration_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.registrations r
    WHERE r.id = p_registration_id
      AND (r.registered_by = p_user_id OR public.is_tournament_organizer(r.tournament_id, p_user_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.registration_in_tournament(p_registration_id UUID, p_tournament_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.registrations r
    WHERE r.id = p_registration_id AND r.tournament_id = p_tournament_id
  );
$$;

REVOKE ALL ON FUNCTION public.user_plays_in_registration(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_registration(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registration_in_tournament(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_plays_in_registration(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_registration(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registration_in_tournament(UUID, UUID) TO authenticated, service_role;

-- Registrations: same rules as before, without reading registration_players under RLS
DROP POLICY IF EXISTS registrations_select_own ON public.registrations;
CREATE POLICY registrations_select_own ON public.registrations FOR SELECT TO authenticated
  USING (
    registered_by = auth.uid()
    OR public.user_plays_in_registration(id, auth.uid())
    OR public.is_tournament_organizer(tournament_id, auth.uid())
  );

-- Registration players: same rules as before, without reading registrations under RLS
DROP POLICY IF EXISTS registration_players_select ON public.registration_players;
CREATE POLICY registration_players_select ON public.registration_players FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_registration(registration_id, auth.uid())
  );

DROP POLICY IF EXISTS registration_players_insert ON public.registration_players;
CREATE POLICY registration_players_insert ON public.registration_players FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.id = registration_id AND r.registered_by = auth.uid()
    )
  );

-- Petition proofs: the tournament/registration match goes through a helper too
DROP POLICY IF EXISTS petition_proofs_insert ON storage.objects;
CREATE POLICY petition_proofs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'petition-proofs'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] IS NOT NULL
    AND public.user_owns_registration((storage.foldername(name))[2]::uuid, auth.uid())
    AND public.registration_in_tournament((storage.foldername(name))[2]::uuid, (storage.foldername(name))[1]::uuid)
  );
