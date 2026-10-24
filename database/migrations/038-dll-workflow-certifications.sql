-- Migration 038: DLL submission workflow + TVL certification tracking
-- Adds review fields to lessons; creates certifications table for NCII/TESDA

-- 1. DLL submission workflow columns on lessons
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS submission_status TEXT NOT NULL DEFAULT 'draft'
  CHECK (submission_status IN ('draft', 'submitted', 'returned', 'approved'));
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS review_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_lessons_submission ON lessons(submission_status);

-- 2. TVL / NCII / TESDA certification tracking
CREATE TABLE IF NOT EXISTS certifications (
  id                BIGSERIAL PRIMARY KEY,
  student_id        BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  certification_type TEXT NOT NULL CHECK (certification_type IN ('NCII', 'TESDA', 'OTHER')),
  cert_name         TEXT NOT NULL,
  specialization    TEXT,
  date_acquired     DATE,
  expiry_date       DATE,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending')),
  issuing_body      TEXT,
  certificate_no    TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certs_student ON certifications(student_id);
CREATE INDEX IF NOT EXISTS idx_certs_type ON certifications(certification_type);
CREATE INDEX IF NOT EXISTS idx_certs_status ON certifications(status);
