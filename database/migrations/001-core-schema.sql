-- ============================================================
-- MeridianEd MVP — Core schema (PostgreSQL 16, canonical)
-- Dialect-specific migration for production. Local dev uses
-- migrations/001-core-schema.sqlite.sql via node:sqlite.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'teacher',
  email         TEXT,
  phone         TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id              BIGSERIAL PRIMARY KEY,
  lrn             TEXT NOT NULL UNIQUE,
  first_name      TEXT NOT NULL,
  middle_name     TEXT,
  last_name       TEXT NOT NULL,
  suffix          TEXT,
  sex             TEXT NOT NULL,
  birth_date      DATE,
  birth_place     TEXT,
  religion        TEXT,
  address         TEXT,
  contact         TEXT,
  guardian_name   TEXT,
  guardian_contact TEXT,
  guardian_relation TEXT,
  grade_level     TEXT NOT NULL,
  track_strand    TEXT,
  status          TEXT NOT NULL DEFAULT 'enrolled',
  photo_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teachers (
  id           BIGSERIAL PRIMARY KEY,
  employee_no  TEXT UNIQUE,
  first_name   TEXT NOT NULL,
  middle_name  TEXT,
  last_name    TEXT NOT NULL,
  suffix       TEXT,
  sex          TEXT,
  position     TEXT,
  prc_no       TEXT,
  email        TEXT,
  contact      TEXT,
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subjects (
  id          BIGSERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT,
  grade_level TEXT NOT NULL,
  track       TEXT NOT NULL DEFAULT 'general',
  units       NUMERIC(4,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sections (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  grade_level     TEXT NOT NULL,
  strand          TEXT,
  adviser_teacher_id BIGINT REFERENCES teachers(id) ON DELETE SET NULL,
  room            TEXT,
  capacity        INTEGER NOT NULL DEFAULT 40,
  school_year     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, school_year)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id          BIGSERIAL PRIMARY KEY,
  student_id  BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id  BIGINT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  school_year TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  strand      TEXT,
  status      TEXT NOT NULL DEFAULT 'enrolled',
  enrolled_at DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, school_year)
);

CREATE TABLE IF NOT EXISTS attendance (
  id           BIGSERIAL PRIMARY KEY,
  student_id   BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id   BIGINT REFERENCES sections(id) ON DELETE SET NULL,
  date         DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'present',
  time_in      TIMESTAMPTZ,
  time_out     TIMESTAMPTZ,
  remarks      TEXT,
  recorded_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

CREATE TABLE IF NOT EXISTS grades (
  id              BIGSERIAL PRIMARY KEY,
  student_id      BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id      BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  section_id      BIGINT REFERENCES sections(id) ON DELETE SET NULL,
  school_year     TEXT NOT NULL,
  quarter         INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  written_work    NUMERIC(5,2),
  performance_task NUMERIC(5,2),
  quarterly_exam  NUMERIC(5,2),
  computed_grade  NUMERIC(5,2),
  remarks         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id, school_year, quarter)
);

CREATE TABLE IF NOT EXISTS announcements (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  audience    TEXT NOT NULL DEFAULT 'all',
  priority    TEXT NOT NULL DEFAULT 'normal',
  author_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  username   TEXT,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  details    TEXT,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

INSERT INTO app_settings (key, value) VALUES
  ('grade_weights', '{"written_work":25,"performance_task":45,"quarterly_exam":30}')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_students_name  ON students (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_enrollments_sec ON enrollments (section_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (date);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades (student_id, school_year, quarter);

CREATE TABLE IF NOT EXISTS class_assignments (
  id               BIGSERIAL PRIMARY KEY,
  school_year      TEXT NOT NULL,
  section_id       BIGINT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id       BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id       BIGINT REFERENCES teachers(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  meetings_per_week INTEGER NOT NULL DEFAULT 1,
  room             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_year, section_id, subject_id)
);

CREATE TABLE IF NOT EXISTS schedule_entries (
  id          BIGSERIAL PRIMARY KEY,
  school_year TEXT NOT NULL,
  section_id  BIGINT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id  BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id  BIGINT REFERENCES teachers(id) ON DELETE SET NULL,
  day         INTEGER NOT NULL CHECK (day BETWEEN 1 AND 5),
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  room        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schedule_year    ON schedule_entries (school_year, day, start_time);
CREATE INDEX IF NOT EXISTS idx_schedule_teacher ON schedule_entries (teacher_id, day, start_time);

CREATE TABLE IF NOT EXISTS report_types (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  group_name    TEXT NOT NULL,
  frequency     TEXT NOT NULL DEFAULT 'periodic',
  is_deped_form BOOLEAN NOT NULL DEFAULT FALSE,
  auto_generate BOOLEAN NOT NULL DEFAULT FALSE,
  required      BOOLEAN NOT NULL DEFAULT TRUE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submission_workflows (
  id             BIGSERIAL PRIMARY KEY,
  report_type_id BIGINT NOT NULL UNIQUE REFERENCES report_types(id) ON DELETE CASCADE,
  review_roles   TEXT NOT NULL DEFAULT '[]',
  approve_roles  TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS report_submissions (
  id            BIGSERIAL PRIMARY KEY,
  report_type_id BIGINT NOT NULL REFERENCES report_types(id) ON DELETE CASCADE,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id    BIGINT REFERENCES teachers(id) ON DELETE SET NULL,
  school_year   TEXT NOT NULL,
  period        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft',
  notes         TEXT,
  due_date      TEXT,
  draft_body    TEXT,
  reviewer_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  review_note   TEXT,
  reviewed_at   TIMESTAMPTZ,
  approver_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subm_user   ON report_submissions (user_id, school_year);
CREATE INDEX IF NOT EXISTS idx_subm_status ON report_submissions (school_year, status);
CREATE INDEX IF NOT EXISTS idx_subm_type   ON report_submissions (report_type_id, school_year);

CREATE TABLE IF NOT EXISTS submission_files (
  id            BIGSERIAL PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES report_submissions(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL DEFAULT 0,
  mime          TEXT,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
