-- Profile avatars. Optimized in the browser (512×512 WebP/JPEG, ≤ ~512 KB) before upload.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-avatars', 'profile-avatars', true, 524288, ARRAY['image/webp', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY profile_avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY profile_avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY profile_avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY profile_avatars_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'profile-avatars');
