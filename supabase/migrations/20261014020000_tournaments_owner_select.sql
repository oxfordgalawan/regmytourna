-- Owners can read their own tournaments (including drafts) without relying on is_tournament_organizer.
CREATE POLICY tournaments_owner_select ON public.tournaments
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
