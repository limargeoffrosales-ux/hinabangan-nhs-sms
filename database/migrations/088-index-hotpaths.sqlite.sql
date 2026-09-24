-- Hot-path query indexes identified in the performance audit.
-- students.lrn is intentionally NOT indexed here: it already carries a UNIQUE
-- constraint from 001, which backs it with an index on both dialects.

CREATE INDEX IF NOT EXISTS idx_class_assign_teacher
  ON class_assignments (teacher_id);

CREATE INDEX IF NOT EXISTS idx_attendance_section
  ON attendance (section_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_year_status
  ON enrollments (school_year, status);