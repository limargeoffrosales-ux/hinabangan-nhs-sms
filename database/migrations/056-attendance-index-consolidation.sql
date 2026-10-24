-- 056-attendance-index-consolidation.sql
-- Finish what 047 only documented: 047 added a coalesced UNIQUE index so NULL
-- sessions could no longer bypass uniqueness, but never dropped 041's weaker
-- index and named its own "nocoalesce" (while actually coalescing). Retire both
-- old indexes and keep a single, clearly-named coalesced unique index on both
-- dialects.

DROP INDEX IF EXISTS idx_attendance_unique_nocoalesce;
DROP INDEX IF EXISTS idx_attendance_student_date_session;

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique
  ON attendance (student_id, date, COALESCE(session, 'default'));