-- Migration 038 (SQLite): DLL submission workflow + TVL certification tracking

-- 1. DLL submission workflow columns on lessons
ALTER TABLE lessons ADD COLUMN submission_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE lessons ADD COLUMN submitted_at TEXT;
ALTER TABLE lessons ADD COLUMN reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE lessons ADD COLUMN reviewed_at TEXT;
ALTER TABLE lessons ADD COLUMN review_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_lessons_submission ON lessons(submission_status);

-- 2. TVL / NCII / TESDA certification tracking
CREATE TABLE IF NOT EXISTS certifications (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id        INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  certification_type TEXT NOT NULL CHECK (certification_type IN ('NCII', 'TESDA', 'OTHER')),
  cert_name         TEXT NOT NULL,
  specialization    TEXT,
  date_acquired     TEXT,
  expiry_date       TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending')),
  issuing_body      TEXT,
  certificate_no    TEXT,
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_certs_student ON certifications(student_id);
CREATE INDEX IF NOT EXISTS idx_certs_type ON certifications(certification_type);
CREATE INDEX IF NOT EXISTS idx_certs_status ON certifications(status);
