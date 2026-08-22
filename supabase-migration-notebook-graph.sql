-- ============================================================
-- Ibuki migration: notebook graph groundwork (Obsidian-style view)
-- ============================================================
-- Prepares the relational schema for a future "relational view" where
-- students can see how their study materials relate to each other.
--
-- Two tables:
--   notebook_concepts : key concepts/topics extracted from each notebook.
--                       Powers tag-style filtering and concept hubs.
--   notebook_links    : directed edges between notebooks ("builds on",
--                       "related to", "contrasts with", ...). Powers the
--                       graph visualization.
--
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard -> your project
--   2. Go to "SQL Editor" -> "New query"
--   3. Paste this entire file and click "Run"
--
-- NOTE: This migration only creates tables. No app UI is wired yet.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Key concepts per notebook
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notebook_concepts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  concept     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notebook_id, concept)
);

CREATE INDEX IF NOT EXISTS idx_notebook_concepts_user
  ON public.notebook_concepts (user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_concepts_concept
  ON public.notebook_concepts (concept);

-- ------------------------------------------------------------
-- 2. Relations between notebooks (graph edges)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notebook_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id      uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  target_id      uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  relation       text NOT NULL DEFAULT 'related',
  label          text,
  strength       numeric CHECK (strength IS NULL OR (strength >= 0 AND strength <= 1)),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, target_id, relation),
  -- A notebook cannot link to itself
  CHECK (source_id <> target_id)
);

CREATE INDEX IF NOT EXISTS idx_notebook_links_source
  ON public.notebook_links (user_id, source_id);
CREATE INDEX IF NOT EXISTS idx_notebook_links_target
  ON public.notebook_links (user_id, target_id);

-- ------------------------------------------------------------
-- 3. Row Level Security
-- ------------------------------------------------------------
ALTER TABLE public.notebook_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own concepts" ON public.notebook_concepts;
CREATE POLICY "Users can read own concepts" ON public.notebook_concepts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own concepts" ON public.notebook_concepts;
CREATE POLICY "Users can insert own concepts" ON public.notebook_concepts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own concepts" ON public.notebook_concepts;
CREATE POLICY "Users can delete own concepts" ON public.notebook_concepts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own links" ON public.notebook_links;
CREATE POLICY "Users can read own links" ON public.notebook_links
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own links" ON public.notebook_links;
CREATE POLICY "Users can insert own links" ON public.notebook_links
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own links" ON public.notebook_links;
CREATE POLICY "Users can delete own links" ON public.notebook_links
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. (OPTIONAL - run later) pgvector setup for semantic similarity
-- ============================================================
-- When your corpus grows large enough that stuffing every notebook into
-- the chat context no longer works (RAG), or when you want to auto-suggest
-- graph edges from embedding similarity, enable pgvector IN THIS SAME
-- database - no separate vector DB needed:
--
--   CREATE EXTENSION IF NOT EXISTS vector;
--
--   CREATE TABLE IF NOT EXISTS public.notebook_embeddings (
--     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--     user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--     notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
--     chunk_text  text NOT NULL,
--     embedding   vector(1536) NOT NULL,   -- match your embedding model's dimension
--     created_at  timestamptz NOT NULL DEFAULT now()
--   );
--
--   CREATE INDEX IF NOT EXISTS idx_notebook_embeddings_vec
--     ON public.notebook_embeddings
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
--
--   ALTER TABLE public.notebook_embeddings ENABLE ROW LEVEL SECURITY;
--
--   CREATE POLICY "Users can read own embeddings" ON public.notebook_embeddings
--     FOR SELECT TO authenticated USING (auth.uid() = user_id);
--   CREATE POLICY "Users can insert own embeddings" ON public.notebook_embeddings
--     FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
--   CREATE POLICY "Users can delete own embeddings" ON public.notebook_embeddings
--     FOR DELETE TO authenticated USING (auth.uid() = user_id);
--
-- Then create an RPC for similarity search, e.g.:
--
--   CREATE OR REPLACE FUNCTION public.match_notebook_chunks(
--     query_embedding vector(1536),
--     p_user_id uuid,
--     match_count int DEFAULT 5
--   )
--   RETURNS TABLE (
--     id uuid,
--     notebook_id uuid,
--     chunk_text text,
--     similarity float
--   )
--   LANGUAGE sql STABLE AS $$
--     SELECT e.id, e.notebook_id, e.chunk_text,
--            1 - (e.embedding <=> query_embedding) AS similarity
--     FROM public.notebook_embeddings e
--     WHERE e.user_id = p_user_id
--     ORDER BY e.embedding <=> query_embedding
--     LIMIT match_count;
--   $$;

-- Verification: both tables should exist with RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('notebook_concepts', 'notebook_links');