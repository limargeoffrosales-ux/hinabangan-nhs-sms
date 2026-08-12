-- ============================================================
-- 007: Enrollment subject checklist + Aral program flag
-- (SQLite mirror)
-- ============================================================

CREATE TABLE IF NOT EXISTS enrollment_subjects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  subject_id    INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (enrollment_id, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollment_subjects_subject
  ON enrollment_subjects (subject_id);

ALTER TABLE enrollments ADD COLUMN is_aral INTEGER NOT NULL DEFAULT 0;
