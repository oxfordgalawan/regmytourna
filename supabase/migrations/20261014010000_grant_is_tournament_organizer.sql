-- RLS policies invoke this helper; authenticated clients must be allowed to execute it.
GRANT EXECUTE ON FUNCTION public.is_tournament_organizer(UUID, UUID) TO authenticated;
