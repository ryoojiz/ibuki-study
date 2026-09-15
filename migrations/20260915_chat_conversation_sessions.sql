-- Index messages by conversation session for the History panel.
CREATE INDEX IF NOT EXISTS idx_chats_conversation_id
  ON chats(conversation_id);