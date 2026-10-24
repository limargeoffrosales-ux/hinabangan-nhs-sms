-- 056-attendance-index-consolidation.sqlite.sql
-- Same as the PostgreSQL migration: drop 041's nullable-session unique index
-- (NULL sessions bypass uniqueness on both dialects) and 047's misleadingly
-- named coalesce index, then keep one clearly-named coalesced unique index.

DROP INDEX IF EXISTS idx_attendance_unique_nocoalesce;
DROP INDEX IF EXISTS idx_attendance_student_date_session;

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique
  ON attendance (student_id, date, COALESCE(session, 'default'));