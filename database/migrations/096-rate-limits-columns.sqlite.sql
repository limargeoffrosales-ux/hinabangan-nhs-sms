-- Add missing columns to rate_limits table (SQLite)
-- SQLite no-op: table is recreated by initRateLimitTable on startup
-- This migration exists for parity with PostgreSQL version

-- Note: SQLite does not support ADD COLUMN with NOT NULL DEFAULT on existing tables
-- The table will be recreated with correct schema by initRateLimitTable() on first startup
-- when it detects the schema mismatch.