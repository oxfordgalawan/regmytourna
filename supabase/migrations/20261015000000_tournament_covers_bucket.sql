-- Tournament cover images. Files are optimized in the browser (≤1600×900 WebP/JPEG)
-- before upload; the bucket rejects anything else or anything over 2 MB.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tournament-covers', 'tournament-covers', true, 2097152, ARRAY['image/webp', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Signed-in users may only write inside their own folder: <user id>/<file>.
CREATE POLICY tournament_covers_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tournament-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY tournament_covers_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'tournament-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY tournament_covers_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tournament-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Public bucket: anyone can view covers (served from the public URL).
CREATE POLICY tournament_covers_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'tournament-covers');
