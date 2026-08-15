-- 022-assignments.sql
-- Postgres variant: Assignment/Homework module (P1 — Learning & assessment).
-- Assignments are attached to a class assignment (teacher + section + subject)
-- and students submit text/link responses that teachers grade (optionally with a rubric).

CREATE TABLE IF NOT EXISTS assignments (
  id                  BIGSERIAL PRIMARY KEY,
  class_assignment_id BIGINT NOT NULL REFERENCES class_assignments(id) ON DELETE CASCADE,
  teacher_id          BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_year         TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  kind                TEXT NOT NULL DEFAULT 'homework',
  total_points        NUMERIC(6,2) NOT NULL DEFAULT 20,
  due_date            TEXT,
  allow_late          BOOLEAN NOT NULL DEFAULT TRUE,
  rubric              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assignments_class   ON assignments (class_assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments (teacher_id, school_year);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id            BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  text_content  TEXT,
  link_url      TEXT,
  status        TEXT NOT NULL DEFAULT 'submitted',
  score         NUMERIC(6,2),
  feedback      TEXT,
  rubric_scores TEXT,
  submitted_at  TIMESTAMPTZ,
  graded_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  graded_at     TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assign ON assignment_submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions (student_id);
