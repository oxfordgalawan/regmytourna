-- Allow authenticated users to create their own profile row if the signup trigger missed it.
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
