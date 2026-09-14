CREATE TABLE IF NOT EXISTS material_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  target_notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('prerequisite', 'builds_on', 'related_to', 'contrasts_with', 'example_of')),
  origin TEXT NOT NULL DEFAULT 'ai' CHECK (origin IN ('ai', 'manual')),
  confidence NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_notebook_id <> target_notebook_id),
  UNIQUE (user_id, source_notebook_id, target_notebook_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_material_relationships_user_id ON material_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_material_relationships_source ON material_relationships(source_notebook_id);
CREATE INDEX IF NOT EXISTS idx_material_relationships_target ON material_relationships(target_notebook_id);

ALTER TABLE material_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own material relationships"
  ON material_relationships FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own material relationships"
  ON material_relationships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own material relationships"
  ON material_relationships FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own material relationships"
  ON material_relationships FOR DELETE USING (auth.uid() = user_id);
