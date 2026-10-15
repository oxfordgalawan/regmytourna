-- Partner notification idempotency + lookup auth user by email (service role only).

ALTER TABLE public.registration_players
  ADD COLUMN IF NOT EXISTS partner_notified_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.auth_user_id_for_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_user_id_for_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_id_for_email(text) TO service_role;
