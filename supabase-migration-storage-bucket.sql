-- ============================================================
-- Ibuki migration: fix source file 404s ("Bucket not found")
-- ============================================================
-- Symptom: opening a stored source (image/PDF/TXT) returns
--   {"statusCode":"404","error":"Bucket not found",
--    "message":"Bucket not found","code":"NoSuchBucket"}
-- even though the files exist.
--
-- Cause: the app serves files through Supabase's PUBLIC object route
--   /storage/v1/object/public/sources/<user>/<file>
-- That route only works when the 'sources' bucket exists AND has
-- public = true. If the bucket was deleted, recreated as private, or
-- its public flag was turned off, every URL returns this exact error.
--
-- Fix: ensure the bucket exists and is public (idempotent), then add
-- storage RLS policies scoped to each user's own folder (<uid>/...).
--
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard -> your project
--   2. Go to "SQL Editor" -> "New query"
--   3. Paste this entire file and click "Run"
--
-- After running, all previously stored URLs work again immediately -
-- no re-upload needed.
-- ============================================================

-- Step 1: Create the bucket if missing, and force it public if it exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('sources', 'sources', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Step 2: Storage RLS policies
-- Files are stored as "<auth.uid()>/<timestamp>-<filename>", so the first
-- path folder is the owner's user id.

DROP POLICY IF EXISTS "Users can upload own sources" ON storage.objects;
CREATE POLICY "Users can upload own sources" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sources'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Public can read sources" ON storage.objects;
CREATE POLICY "Public can read sources" ON storage.objects
  FOR SELECT USING (bucket_id = 'sources');

DROP POLICY IF EXISTS "Users can delete own sources" ON storage.objects;
CREATE POLICY "Users can delete own sources" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'sources'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verification:
--   SELECT id, public FROM storage.buckets WHERE id = 'sources';
--   -> should return one row with public = true