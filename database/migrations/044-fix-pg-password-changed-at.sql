-- Migration 044 (PostgreSQL): Add missing password_changed_at column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
