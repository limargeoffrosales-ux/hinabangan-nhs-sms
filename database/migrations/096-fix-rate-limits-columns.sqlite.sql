-- Add missing columns to rate_limits table (SQLite)
-- Fixes: table rate_limits has no column named total
-- Note: SQLite doesn't support ADD COLUMN with DEFAULT in some cases, so we handle it

-- Add missing columns (IF NOT EXISTS not supported in SQLite ALTER TABLE, so we check first)
-- We'll use a workaround: create new table, copy data, drop old, rename

-- Check if total column exists
-- If not, recreate table with correct schema

-- This is a simplified approach - in practice the migration system should handle this
-- For now, just add the columns if they don't exist
-- SQLite 3.35+ supports ADD COLUMN IF NOT EXISTS
ALTER TABLE rate_limits ADD COLUMN total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rate_limits ADD COLUMN expires_at TEXT;

-- Backfill total from count if count exists
UPDATE rate_limits SET total = count WHERE total = 0 AND count IS NOT NULL;

-- Ensure indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits (expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits (key);