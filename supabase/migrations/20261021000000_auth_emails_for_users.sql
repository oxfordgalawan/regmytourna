-- Organizer registrations tab: look up players' account emails in one call (service role only).

CREATE OR REPLACE FUNCTION public.auth_emails_for_users(p_ids uuid[])
RETURNS TABLE (id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id, u.email::text FROM auth.users u WHERE u.id = ANY (p_ids);
$$;

REVOKE ALL ON FUNCTION public.auth_emails_for_users(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_emails_for_users(uuid[]) TO service_role;
