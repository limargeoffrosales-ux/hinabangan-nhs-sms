-- ============================================================
-- 011: AI Document Generator — saved document storage (SQLite mirror)
-- ============================================================

CREATE TABLE IF NOT EXISTS doc_generations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'template',
  source_id  TEXT,
  body       TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_doc_generations_created_at ON doc_generations (created_at);
CREATE INDEX IF NOT EXISTS idx_doc_generations_created_by ON doc_generations (created_by);
