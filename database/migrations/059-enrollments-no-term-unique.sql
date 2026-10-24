-- ============================================================
-- 059: Enforce one JHS (term NULL) enrollment per student/year
-- (PostgreSQL)
--
-- The existing UNIQUE (student_id, school_year, term) constraint
-- does not protect term-NULL rows: both PG and SQLite treat NULLs
-- as distinct in a UNIQUE constraint, so a learner can be enrolled
-- multiple times for the same year with no term. Add a partial
-- unique index that closes the gap.
-- ============================================================

-- 1. Remove legacy duplicates (keep the lowest id per student/year).
DELETE FROM enrollments a
USING enrollments b
WHERE a.term IS NULL AND b.term IS NULL
  AND a.student_id = b.student_id
  AND a.school_year = b.school_year
  AND a.id > b.id;

-- 2. Partial unique index for JHS enrollments (term is NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollments_student_sy_no_term
  ON enrollments (student_id, school_year)
  WHERE term IS NULL;