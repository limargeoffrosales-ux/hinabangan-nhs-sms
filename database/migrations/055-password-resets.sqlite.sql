-- 055-password-resets.sqlite.sql
-- Same table as the PostgreSQL migration, SQLite dialect. `datetime('now')`
-- is UTC in the same shape we insert for created_at/used_at so text
-- comparisons stay consistent.

CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at);