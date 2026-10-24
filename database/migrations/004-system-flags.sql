-- ============================================================
-- System flags table (used for one-shot operations like
-- the demo-data purge)
-- ============================================================

CREATE TABLE IF NOT EXISTS system_flags (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
