-- Migration 086: Prune high-churn log tables (SQLite mirror)
-- Mirrors the PG migration for local development.

DELETE FROM data_access_logs WHERE created_at < datetime('now', '-90 days');
DELETE FROM audit_logs       WHERE created_at < datetime('now', '-180 days');
DELETE FROM notifications    WHERE created_at < datetime('now', '-90 days');
DELETE FROM ai_chat_logs     WHERE created_at < datetime('now', '-90 days');
DELETE FROM password_resets  WHERE created_at < datetime('now', '-30 days') OR used_at IS NOT NULL;
DELETE FROM refresh_tokens   WHERE revoked = 1 OR expires_at < datetime('now');
DELETE FROM device_tokens    WHERE updated_at < datetime('now', '-180 days');