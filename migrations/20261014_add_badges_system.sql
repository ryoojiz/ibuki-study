-- Create badges definition table
CREATE TABLE badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- Emoji or image path
    criteria_type TEXT NOT NULL, -- 'notebooks_count', 'streak_days', 'subjects_count', 'chat_count'
    criteria_value INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_badges mapping table
CREATE TABLE user_badges (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_id TEXT REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);

-- Seed initial badges
INSERT INTO badges (id, name, description, icon, criteria_type, criteria_value) VALUES
('archivist', 'The Archivist', 'Create 10 notebooks', '📚', 'notebooks_count', 10),
('consistency_king', 'Consistency King', 'Maintain a 7-day streak', '🔥', 'streak_days', 7),
('polymath', 'Polymath', 'Explore 3 different subjects', '🌐', 'subjects_count', 3),
('ai_whisperer', 'AI Whisperer', '50 interactions with the AI coach', '💬', 'chat_count', 50);
