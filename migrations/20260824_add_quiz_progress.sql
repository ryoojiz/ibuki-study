-- Add progress tracking to quizzes: stores per-question answers, completion
-- status, and the best score achieved across attempts.
--
-- progress JSONB shape:
--   {
--     "answers": [0, null, 2, ...],   -- selected option index per question (null = unanswered)
--     "completed": false,             -- true once an attempt has been finished
--     "best_score_pct": null          -- highest score (%) across completed attempts
--   }
--
-- Run AFTER migrations/20260823_add_quizzes_table.sql

ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS progress JSONB NOT NULL DEFAULT '{"answers": [], "completed": false, "best_score_pct": null}'::jsonb;

COMMENT ON COLUMN quizzes.progress IS 'Per-quiz attempt state: answers array, completion flag, and best score percentage';