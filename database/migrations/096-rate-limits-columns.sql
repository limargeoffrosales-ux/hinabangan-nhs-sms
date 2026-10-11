-- Add missing columns to rate_limits table (PostgreSQL)
-- Fixes: table rate_limits has no column named total
-- Adds total and expires_at columns if they don't exist

-- Add total column
ALTER TABLE rate_limits
  ADD COLUMN IF NOT EXISTS total INTEGER NOT NULL DEFAULT 0;

-- Add expires_at column
ALTER TABLE rate_limits
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill expires_at from window_start + 15 minutes (default window)
UPDATE rate_limits
SET expires_at = window_start + INTERVAL '15 minutes'
WHERE expires_at IS NULL;