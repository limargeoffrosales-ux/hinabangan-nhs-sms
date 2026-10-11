-- Shared rate-limit counters (PostgreSQL)
-- Database-backed store for express-rate-limit, compatible with rate-limit-store.js
CREATE TABLE IF NOT EXISTS rate_limits (
  id           BIGSERIAL PRIMARY KEY,
  key          TEXT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits (key);