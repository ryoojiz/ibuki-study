-- 2026-11-23: Add usage quotas + admin controls.
--
-- Global defaults table (id='global'): notebook_limit, subject_max,
-- monthly_token_limit, notebook_cost, chat_cost.
-- Per-user overrides + usage + is_admin are added to `profiles`.
--
-- Apply via: https://supabase.com/dashboard/<project>/sql/new
-- Then seed an admin account (run: node tools/create-admin.js).

-- 1. Global quota defaults -------------------------------------------------
CREATE TABLE IF NOT EXISTS quota_global (
    id TEXT PRIMARY KEY DEFAULT 'global',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notebook_limit INTEGER NOT NULL DEFAULT 100 CHECK (notebook_limit >= 0),
    subject_max INTEGER NOT NULL DEFAULT 12 CHECK (subject_max >= 0),
    monthly_token_limit INTEGER NOT NULL DEFAULT 1000 CHECK (monthly_token_limit >= 0),
    notebook_cost INTEGER NOT NULL DEFAULT 3 CHECK (notebook_cost >= 0),
    chat_cost INTEGER NOT NULL DEFAULT 1 CHECK (chat_cost >= 0)
);

INSERT INTO quota_global (id, notebook_limit, subject_max, monthly_token_limit, notebook_cost, chat_cost)
VALUES ('global', 100, 12, 1000, 3, 1)
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW(),
    notebook_limit = EXCLUDED.notebook_limit,
    subject_max = EXCLUDED.subject_max,
    monthly_token_limit = EXCLUDED.monthly_token_limit,
    notebook_cost = EXCLUDED.notebook_cost,
    chat_cost = EXCLUDED.chat_cost;

-- 2. Per-user quota, usage and admin flag on profiles ----------------------
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS quota_notebook INTEGER,          -- 0 = use global default
    ADD COLUMN IF NOT EXISTS quota_subject INTEGER,           -- 0 = use global default
    ADD COLUMN IF NOT EXISTS quota_token INTEGER,             -- monthly token limit (0 => global)
    ADD COLUMN IF NOT EXISTS usage_notebook INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS usage_subject INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS usage_token INTEGER NOT NULL DEFAULT 0,   -- tokens used this month
    ADD COLUMN IF NOT EXISTS usage_chat INTEGER NOT NULL DEFAULT 0,    -- "other tools" (1 token each)
    ADD COLUMN IF NOT EXISTS quota_updated_at TIMESTAMPTZ;

COMMENT ON TABLE quota_global IS 'Global usage quota defaults. Id must be "global".';
COMMENT ON COLUMN quota_global.notebook_limit IS 'Max notebooks per user globally';
COMMENT ON COLUMN quota_global.subject_max IS 'Max distinct subjects per user globally';
COMMENT ON COLUMN quota_global.monthly_token_limit IS 'Tokens per month per user globally';
COMMENT ON COLUMN quota_global.notebook_cost IS 'Tokens charged when creating a notebook';
COMMENT ON COLUMN quota_global.chat_cost IS 'Tokens charged per chat / other tool';
COMMENT ON COLUMN profiles.is_admin IS 'True => this user is an admin (can manage quotas/accounts)';
COMMENT ON COLUMN profiles.quota_notebook IS 'Notebook limit for this user; 0 = inherit global';
COMMENT ON COLUMN profiles.quota_subject IS 'Subject limit for this user; 0 = inherit global';
COMMENT ON COLUMN profiles.quota_token IS 'Monthly token limit for this user; 0 = inherit global';
COMMENT ON COLUMN profiles.usage_notebook IS 'Notebook count (lifetime)';
COMMENT ON COLUMN profiles.usage_subject IS 'Distinct-subject count (lifetime)';
COMMENT ON COLUMN profiles.usage_token IS 'Tokens used this calendar month';
COMMENT ON COLUMN profiles.usage_chat IS 'Other tool / chat interactions (lifetime)';
COMMENT ON COLUMN profiles.quota_updated_at IS 'When this user''s quota was last changed';
