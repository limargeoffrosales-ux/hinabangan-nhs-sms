-- ============================================================
-- 062: Enrollment requirement documents
-- (PostgreSQL)
-- ============================================================

-- Files attached to an enrollment record (PSA birth cert, Form 138/SF9,
-- Good Moral, etc.). Files themselves are uploaded via /uploads/file; this
-- table records which requirement belongs to which enrollment.
CREATE TABLE IF NOT EXISTS enrollment_documents (
  id            BIGSERIAL PRIMARY KEY,
  enrollment_id BIGINT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  doc_type      TEXT NOT NULL,
  file_key      TEXT,
  file_url      TEXT NOT NULL,
  file_name     TEXT,
  uploaded_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enrollment_documents_enrollment
  ON enrollment_documents (enrollment_id);