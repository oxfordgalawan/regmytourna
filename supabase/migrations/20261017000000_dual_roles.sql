-- A user can be a player, an organizer, or both. `account_type` stays the role
-- they signed up with (their default view); these flags record what's switched on.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS player_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS organizer_enabled BOOLEAN NOT NULL DEFAULT false;

-- existing users keep exactly what they had
UPDATE public.profiles SET player_enabled = true WHERE account_type = 'player';
UPDATE public.profiles SET organizer_enabled = true WHERE account_type = 'organizer';
UPDATE public.profiles p SET organizer_enabled = true
WHERE EXISTS (SELECT 1 FROM public.tournaments t WHERE t.owner_id = p.id);
