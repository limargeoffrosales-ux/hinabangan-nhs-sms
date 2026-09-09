-- 058-ai-chat-log-retention.sql
-- Give AI chat history a default retention policy (90 days) so it participates
-- in the same data-retention purge as notifications/audit logs. Admin can edit
-- or disable it in Privacy → Data Retention; without this the logs lived
-- forever (short of a right-to-erasure request).

INSERT INTO data_retention_policies (entity, retention_days, enabled, description)
VALUES ('ai_chat_logs', 90, TRUE, 'AI assistant chat history — 90 days')
ON CONFLICT (entity) DO NOTHING;