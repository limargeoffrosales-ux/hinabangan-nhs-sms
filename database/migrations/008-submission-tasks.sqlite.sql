-- ============================================================
-- 008: Submission tasks (admin-assigned) — no file uploads
-- (SQLite mirror)
-- ============================================================

ALTER TABLE report_submissions ADD COLUMN assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE report_submissions ADD COLUMN assigned_at TEXT;
CREATE INDEX IF NOT EXISTS idx_report_submissions_assigned
  ON report_submissions (assigned_by, school_year);
