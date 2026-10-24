-- 058-ai-chat-log-retention.sqlite.sql
-- Same as the PostgreSQL migration: seed a 90-day retention policy for AI chat
-- history.

INSERT INTO data_retention_policies (entity, retention_days, enabled, description)
VALUES ('ai_chat_logs', 90, 1, 'AI assistant chat history — 90 days')
ON CONFLICT (entity) DO NOTHING;