-- 034: Fix SQLite MFA — add mfa_enabled and mfa_secret to users table
-- Migration 026-sqlite.sql created a separate user_mfa table instead of adding
-- columns to users. All server code queries users.mfa_enabled directly, so
-- SQLite users need these columns on the users table.

ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN mfa_secret TEXT;
