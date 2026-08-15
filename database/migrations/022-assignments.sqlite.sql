-- 022-assignments.sqlite.sql
-- SQLite variant: Assignment/Homework module (P1 — Learning & assessment).

CREATE TABLE IF NOT EXISTS assignments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  class_assignment_id INTEGER NOT NULL REFERENCES class_assignments(id) ON DELETE CASCADE,
  teacher_id          INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_year         TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  kind                TEXT NOT NULL DEFAULT 'homework',
  total_points        NUMERIC(6,2) NOT NULL DEFAULT 20,
  due_date            TEXT,
  allow_late          INTEGER NOT NULL DEFAULT 1,
  rubric              TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assignments_class   ON assignments (class_assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments (teacher_id, school_year);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  text_content  TEXT,
  link_url      TEXT,
  status        TEXT NOT NULL DEFAULT 'submitted',
  score         NUMERIC(6,2),
  feedback      TEXT,
  rubric_scores TEXT,
  submitted_at  TEXT,
  graded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  graded_at     TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assign ON assignment_submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions (student_id);
