-- Migration 089: DB-backed CSRF tokens (SQLite mirror)
-- Same purpose as the PG migration: tokens survive deploys/sleeps, hashed.

CREATE TABLE IF NOT EXISTS csrf_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, token_hash)
);

CREATE INDEX IF NOT EXISTS idx_csrf_tokens_user ON csrf_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expiry ON csrf_tokens (expires_at);

DELETE FROM csrf_tokens WHERE expires_at < datetime('now');