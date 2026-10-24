-- ============================================================
-- System flags table (SQLite variant)
-- ============================================================

CREATE TABLE IF NOT EXISTS system_flags (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);