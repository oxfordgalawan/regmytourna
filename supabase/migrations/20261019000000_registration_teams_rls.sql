-- Players registering online can create a team row for doubles (organizer-only policy blocked this).

CREATE POLICY teams_player_insert ON public.teams FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournament_divisions d
      JOIN public.tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id
        AND t.status = 'registration_open'
        AND t.is_public = true
    )
  );

CREATE POLICY team_members_player_insert ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY team_members_player_select ON public.team_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Organizers and registrants can read entrant display names on entries they can see.
CREATE POLICY profiles_select_registration_entrants ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.registration_players rp
      JOIN public.registrations r ON r.id = rp.registration_id
      WHERE rp.user_id = profiles.id
        AND (
          r.registered_by = auth.uid()
          OR public.is_tournament_organizer(r.tournament_id, auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.registration_players mine
            WHERE mine.registration_id = r.id AND mine.user_id = auth.uid()
          )
        )
    )
  );
