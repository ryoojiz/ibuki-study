-- Add flashcards column to notebooks table to store generated study cards
-- Using JSONB to store an array of {question: string, answer: string} objects

ALTER TABLE notebooks 
ADD COLUMN IF NOT EXISTS flashcards JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN notebooks.flashcards IS 'Stores an array of flashcards generated for the notebook';