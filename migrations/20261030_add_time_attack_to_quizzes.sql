-- Add Time Attack mode and timer settings to quizzes
-- Run AFTER migrations/20260824_add_quiz_progress.sql

ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS timer_seconds INTEGER DEFAULT 15;

COMMENT ON COLUMN quizzes.mode IS 'Quiz mode: standard (untimed) or time_attack (timed with streak combos)';
COMMENT ON COLUMN quizzes.timer_seconds IS 'Timer duration per question in seconds for time_attack mode';
