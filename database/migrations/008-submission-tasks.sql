-- ============================================================
-- 008: Submission tasks (admin-assigned) — no file uploads
-- (PostgreSQL)
-- ============================================================

-- Track which admin initiated/gave a submission task to a teacher.
-- Compliance is computed only from these assigned tasks.
ALTER TABLE report_submissions ADD COLUMN IF NOT EXISTS assigned_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE report_submissions ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_report_submissions_assigned
  ON report_submissions (assigned_by, school_year);
