-- Add missing columns to rate_limits table (PostgreSQL)
-- Fixes: table rate_limits has no column named total
ALTER TABLE rate_limits
  ADD COLUMN IF NOT EXISTS id BIGSERIAL,
  ADD COLUMN IF NOT EXISTS total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill total from count if count exists
UPDATE rate_limits SET total = count WHERE total = 0 AND count IS NOT NULL;

-- Drop count column if it exists (cleanup)
-- Note: PostgreSQL doesn't support DROP COLUMN IF EXISTS in all versions
-- ALTER TABLE rate_limits DROP COLUMN IF EXISTS count;

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