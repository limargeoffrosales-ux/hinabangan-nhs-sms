-- Add missing columns to rate_limits table (PostgreSQL)
-- Note: 093-rate-limits.sql already creates the table with total column
-- This migration only adds expires_at if missing (for older deployments)
ALTER TABLE rate_limits
  ADD COLUMN IF NOT EXISTS id BIGSERIAL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Ensure UNIQUE constraint on (key, window_start)
-- (Should already exist from migration 093, but safe to verify)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rate_limits_key_window_start_key'
  ) THEN
    ALTER TABLE rate_limits ADD CONSTRAINT rate_limits_key_window_start_key UNIQUE (key, window_start);
  END IF;
END $$;

-- Ensure indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits (expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits (key);