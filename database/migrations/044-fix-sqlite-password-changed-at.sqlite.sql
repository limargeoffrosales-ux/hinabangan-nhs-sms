-- Migration 044 (SQLite): Add missing password_changed_at column to users
ALTER TABLE users ADD COLUMN password_changed_at TEXT;
