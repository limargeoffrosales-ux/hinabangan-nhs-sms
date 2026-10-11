-- Shared rate-limit counters (SQLite)
-- Database-backed store for express-rate-limit, compatible with rate-limit-store.js
CREATE TABLE IF NOT EXISTS rate_limits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  key          TEXT NOT NULL,
  total        INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT NOT NULL,
  UNIQUE (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits (expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits (key);