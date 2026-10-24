-- ============================================================
-- Soft delete / recycle bin for critical tables (SQLite)
-- ============================================================

-- Students
ALTER TABLE students ADD COLUMN deleted_at TEXT;
ALTER TABLE students ADD COLUMN deleted_by INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_students_deleted_at ON students(deleted_at) WHERE deleted_at IS NOT NULL;

-- Grades
ALTER TABLE grades ADD COLUMN deleted_at TEXT;
ALTER TABLE grades ADD COLUMN deleted_by INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_grades_deleted_at ON grades(deleted_at) WHERE deleted_at IS NOT NULL;

-- Announcements
ALTER TABLE announcements ADD COLUMN deleted_at TEXT;
ALTER TABLE announcements ADD COLUMN deleted_by INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_announcements_deleted_at ON announcements(deleted_at) WHERE deleted_at IS NOT NULL;

-- Sections
ALTER TABLE sections ADD COLUMN deleted_at TEXT;
ALTER TABLE sections ADD COLUMN deleted_by INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_sections_deleted_at ON sections(deleted_at) WHERE deleted_at IS NOT NULL;

-- Subjects
ALTER TABLE subjects ADD COLUMN deleted_at TEXT;
ALTER TABLE subjects ADD COLUMN deleted_by INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_subjects_deleted_at ON subjects(deleted_at) WHERE deleted_at IS NOT NULL;

-- Teachers
ALTER TABLE teachers ADD COLUMN deleted_at TEXT;
ALTER TABLE teachers ADD COLUMN deleted_by INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_teachers_deleted_at ON teachers(deleted_at) WHERE deleted_at IS NOT NULL;

-- Enrollments
ALTER TABLE enrollments ADD COLUMN deleted_at TEXT;
ALTER TABLE enrollments ADD COLUMN deleted_by INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_enrollments_deleted_at ON enrollments(deleted_at) WHERE deleted_at IS NOT NULL;

-- Attendance
ALTER TABLE attendance ADD COLUMN deleted_at TEXT;
ALTER TABLE attendance ADD COLUMN deleted_by INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_attendance_deleted_at ON attendance(deleted_at) WHERE deleted_at IS NOT NULL;

-- Audit log: add diff column for old->new values
ALTER TABLE audit_logs ADD COLUMN diff_json TEXT;