-- ============================================================
-- ibuki-study: Settings migration
-- ------------------------------------------------------------
-- This migration adds dedicated columns to the `profiles` table
-- for the new settings sections introduced in the Settings UI.
--
-- Columns added:
--   llm           JSONB   – provider, model, baseUrl, apiKey, textboxModel
--   appearance    JSONB   – darkMode, primaryColor
--   subjects      JSONB   – array of subject strings
--   behaviour     JSONB   – autoSummarise, chatFeedback
--   localization  JSONB   – interfaceLang, llmLang
--
-- Existing code in `dbService.updateProfile` upserts an object where the
-- keys correspond to these column names, so they must exist.
-- ============================================================

-- Ensure the `profiles` table exists before altering it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS llm jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS appearance jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS subjects jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS behaviour jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS localization jsonb DEFAULT '{}'::jsonb;
  ELSE
    RAISE NOTICE 'Table profiles does not exist yet – migration will run later when the table is created.';
  END IF;
END $$;

-- Optional: set NOT NULL constraints if desired (currently allow NULL for backward compatibility)
