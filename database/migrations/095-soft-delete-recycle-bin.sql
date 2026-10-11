-- ============================================================
-- Soft delete / recycle bin for critical tables
-- Adds deleted_at, deleted_by to enable undo without full restore
-- ============================================================

-- Students: soft delete with cascade protection on enrollments
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_students_deleted_at ON students(deleted_at) WHERE deleted_at IS NOT NULL;

-- Grades: soft delete individual grade rows
ALTER TABLE grades
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_grades_deleted_at ON grades(deleted_at) WHERE deleted_at IS NOT NULL;

-- Announcements: soft delete
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_announcements_deleted_at ON announcements(deleted_at) WHERE deleted_at IS NOT NULL;

-- Sections: soft delete (protects enrollments via FK)
ALTER TABLE sections
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_sections_deleted_at ON sections(deleted_at) WHERE deleted_at IS NOT NULL;

-- Subjects: soft delete
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_subjects_deleted_at ON subjects(deleted_at) WHERE deleted_at IS NOT NULL;

-- Teachers: soft delete
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_teachers_deleted_at ON teachers(deleted_at) WHERE deleted_at IS NOT NULL;

-- Enrollments: soft delete (instead of status='withdrawn' only)
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_enrollments_deleted_at ON enrollments(deleted_at) WHERE deleted_at IS NOT NULL;

-- Attendance: soft delete individual records
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_attendance_deleted_at ON attendance(deleted_at) WHERE deleted_at IS NOT NULL;

-- Audit log: add diff column for old->new values
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS diff_json JSONB;

CREATE INDEX IF NOT EXISTS idx_audit_logs_diff ON audit_logs USING GIN (diff_json) WHERE diff_json IS NOT NULL;