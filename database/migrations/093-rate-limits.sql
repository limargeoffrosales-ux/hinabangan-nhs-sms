-- Shared rate-limit counters (PostgreSQL)
-- Database-backed store for express-rate-limit, compatible with rate-limit-store.js
CREATE TABLE IF NOT EXISTS rate_limits (
  id           BIGSERIAL PRIMARY KEY,
  key          TEXT NOT NULL,
  total        INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  UNIQUE (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits (expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits (key);