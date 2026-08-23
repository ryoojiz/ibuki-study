-- Create quizzes table to store AI-generated study quizzes.
-- A quiz is scoped either to a single notebook (notebook_id set) or to a
-- whole subject (subject set, notebook_id null).
-- questions is JSONB storing an array of:
--   { question: string, options: string[4], correct_index: number, explanation: string }

CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
  subject TEXT,
  difficulty TEXT,
  focus TEXT,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_notebook_id ON quizzes(notebook_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_subject ON quizzes(subject);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quizzes"
  ON quizzes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quizzes"
  ON quizzes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quizzes"
  ON quizzes FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE quizzes IS 'Stores AI-generated multiple-choice study quizzes scoped to a notebook or a subject';