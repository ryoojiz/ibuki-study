-- One idempotent activity record per learner and local calendar day.
-- The client supplies study_date in the learner's device timezone.
CREATE TABLE IF NOT EXISTS study_days (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, study_date)
);

ALTER TABLE study_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own study days"
  ON study_days FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study days"
  ON study_days FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE study_days IS 'One row for each local calendar day on which a user submits a quiz answer.';
