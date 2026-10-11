-- Fix rate_limits table schema to match migration 093 (use 'count' not 'total')
-- This migration handles databases where initRateLimitTable created the table with 'total' column

-- PostgreSQL version
ALTER TABLE rate_limits RENAME TO rate_limits_old;

CREATE TABLE rate_limits (
  key          TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

INSERT INTO rate_limits (key, window_start, count)
SELECT key, window_start, COALESCE(total, count, 1) FROM rate_limits_old;

DROP TABLE rate_limits_old;

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start);