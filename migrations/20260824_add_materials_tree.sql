-- ============================================================================
-- Relational materials tree
-- ----------------------------------------------------------------------------
-- Introduces a unified, self-referencing hierarchy:
--
--   Subject root (depth 0, parent_id IS NULL)
--     └─ Material
--         └─ Submaterial
--             └─ ... (arbitrary depth)
--
-- Notebooks attach to ANY node via notebooks.material_id. Deleting a material
-- cascades to its sub-materials but only UNASSIGNS notebooks (SET NULL).
--
-- Also lays groundwork for future chat-history UI:
--   - conversations table (one row per chat conversation)
--   - chats.conversation_id + chats.meta (per-message metadata such as the
--     citation registry snapshot used at send time)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. materials table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materials_user_id ON materials(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_parent_id ON materials(parent_id);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own materials"
  ON materials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own materials"
  ON materials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own materials"
  ON materials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own materials"
  ON materials FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE materials IS 'Unified relational tree of subjects, materials and sub-materials (adjacency list via parent_id)';

-- ---------------------------------------------------------------------------
-- 2. notebooks.material_id
-- ---------------------------------------------------------------------------
ALTER TABLE notebooks
  ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notebooks_material_id ON notebooks(material_id);

-- ---------------------------------------------------------------------------
-- 3. Backfill: migrate flat subject/material strings into the tree
--    Root node per distinct subject, child node per distinct material,
--    then link every notebook to its node.
-- ---------------------------------------------------------------------------

-- 3a. Subject roots
INSERT INTO materials (user_id, parent_id, name)
SELECT DISTINCT user_id, NULL, subject
FROM notebooks
WHERE subject IS NOT NULL AND subject <> '';

-- 3b. Material nodes under their subject root
INSERT INTO materials (user_id, parent_id, name)
SELECT DISTINCT n.user_id, r.id, n.material
FROM notebooks n
JOIN materials r
  ON r.user_id = n.user_id
 AND r.parent_id IS NULL
 AND r.name = n.subject
WHERE n.material IS NOT NULL AND n.material <> '';

-- 3c. Link notebooks that had a material string
UPDATE notebooks n
SET material_id = m.id
FROM materials m
JOIN materials r ON r.id = m.parent_id
WHERE m.parent_id IS NOT NULL
  AND m.user_id = n.user_id
  AND m.name = n.material
  AND r.name = n.subject
  AND n.material_id IS NULL;

-- 3d. Link notebooks without a material straight to their subject root
UPDATE notebooks n
SET material_id = r.id
FROM materials r
WHERE r.parent_id IS NULL
  AND r.user_id = n.user_id
  AND r.name = n.subject
  AND n.material_id IS NULL
  AND (n.material IS NULL OR n.material = '');

-- ---------------------------------------------------------------------------
-- 4. Chat history groundwork (conversations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Scope key identical to the current chat storage key:
  --   '<notebook-uuid>' | 'subject:<name>' | 'global_chat'
  scope_key TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_scope_key ON conversations(scope_key);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE conversations IS 'Chat conversations; scope_key mirrors the legacy per-scope chat storage key';

-- chats: link to conversation + per-message metadata (citation snapshots etc.)
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;

ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill: one default conversation per existing scope, then link messages
INSERT INTO conversations (user_id, scope_key, title)
SELECT DISTINCT user_id, COALESCE(notebook_id, 'global_chat'), 'Conversation'
FROM chats;

UPDATE chats c
SET conversation_id = cv.id
FROM conversations cv
WHERE cv.user_id = c.user_id
  AND cv.scope_key = COALESCE(c.notebook_id, 'global_chat')
  AND c.conversation_id IS NULL;