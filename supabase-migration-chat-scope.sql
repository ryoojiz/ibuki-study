-- ============================================================
-- Ibuki migration: allow non-notebook chat scopes (global/subject)
-- ============================================================
-- Problem: the `chats.notebook_id` column is of type UUID, but the app
-- now stores chat history for the Global Assistant ('global_chat') and
-- per-subject chats ('subject:<Name>') in the same column. Postgres
-- rejects those values with:
--   "invalid input syntax for type uuid"
--
-- Fix: convert `chats.notebook_id` from UUID to TEXT. Existing rows keep
-- their values (UUIDs become their text representation), and scope
-- strings are accepted from now on.
--
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard -> your project
--   2. Go to "SQL Editor" -> "New query"
--   3. Paste this entire file and click "Run"
-- ============================================================

-- Step 1: Drop the foreign key on chats.notebook_id if one exists.
-- (The app already deletes a notebook's chats explicitly in
--  dbService.deleteNotebook, so cascade cleanup is preserved.)
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT c.conname INTO fk_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE c.contype = 'f'
    AND n.nspname = 'public'
    AND t.relname = 'chats'
    AND c.confrelid = 'public.notebooks'::regclass;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.chats DROP CONSTRAINT %I', fk_name);
    RAISE NOTICE 'Dropped foreign key constraint: %', fk_name;
  ELSE
    RAISE NOTICE 'No foreign key found on chats.notebook_id';
  END IF;
END $$;

-- Step 2: Convert the column type (preserves all existing chat rows)
ALTER TABLE public.chats
  ALTER COLUMN notebook_id TYPE text
  USING notebook_id::text;

-- Step 3 (optional): if your RLS policy on `chats` restricts inserts to
-- notebooks that exist (e.g. a subquery against `notebooks`), relax it so
-- global/subject chats are allowed. Example:
--
-- DROP POLICY IF EXISTS "Users can insert own chats" ON public.chats;
-- CREATE POLICY "Users can insert own chats" ON public.chats
--   FOR INSERT TO authenticated
--   WITH CHECK (auth.uid() = user_id);
--
-- (Run Step 3 only if inserts still fail with a "violates row-level
--  security policy" error after Steps 1-2.)

-- Verification: this should now succeed without errors
-- SELECT notebook_id, count(*) FROM public.chats GROUP BY notebook_id;