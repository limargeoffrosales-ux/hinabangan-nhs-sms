-- ============================================================
-- 062: Enrollment requirement documents
-- (SQLite mirror)
-- ============================================================

CREATE TABLE IF NOT EXISTS enrollment_documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  doc_type      TEXT NOT NULL,
  file_key      TEXT,
  file_url      TEXT NOT NULL,
  file_name     TEXT,
  uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_enrollment_documents_enrollment
  ON enrollment_documents (enrollment_id);