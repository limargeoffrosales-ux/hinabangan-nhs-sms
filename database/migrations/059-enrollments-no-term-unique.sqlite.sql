-- ============================================================
-- 059: Enforce one JHS (term NULL) enrollment per student/year
-- (SQLite)
--
-- The existing UNIQUE (student_id, school_year, term) constraint
-- treats NULLs as distinct, so term-NULL rows are never protected.
-- Add a partial unique index for JHS enrollments after clearing
-- any legacy duplicates.
-- ============================================================

-- 1. Remove legacy duplicates (keep the lowest id per student/year).
DELETE FROM enrollments WHERE id IN (
  SELECT id FROM enrollments e
  WHERE e.term IS NULL AND EXISTS (
    SELECT 1 FROM enrollments e2
    WHERE e2.term IS NULL
      AND e2.student_id = e.student_id
      AND e2.school_year = e.school_year
      AND e2.id < e.id
  )
);

-- 2. Partial unique index for JHS enrollments (term is NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollments_student_sy_no_term
  ON enrollments (student_id, school_year)
  WHERE term IS NULL;