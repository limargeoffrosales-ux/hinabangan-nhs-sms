-- ============================================================
-- MeridianEd MVP — Core schema (SQLite via node:sqlite)
-- Local-dev fallback mirror of 001-core-schema.sql.
-- MUST remain structurally identical to the PostgreSQL file.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'teacher',
  email         TEXT,
  phone         TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  lrn              TEXT NOT NULL UNIQUE,
  first_name       TEXT NOT NULL,
  middle_name      TEXT,
  last_name        TEXT NOT NULL,
  suffix           TEXT,
  sex              TEXT NOT NULL,
  birth_date       TEXT,
  birth_place      TEXT,
  religion         TEXT,
  address          TEXT,
  contact          TEXT,
  guardian_name    TEXT,
  guardian_contact TEXT,
  guardian_relation TEXT,
  grade_level      TEXT NOT NULL,
  track_strand     TEXT,
  status           TEXT NOT NULL DEFAULT 'enrolled',
  photo_url        TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teachers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subjects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT,
  grade_level TEXT NOT NULL,
  track       TEXT NOT NULL DEFAULT 'general',
  units       REAL NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sections (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  grade_level        TEXT NOT NULL,
  strand             TEXT,
  adviser_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  room               TEXT,
  capacity           INTEGER NOT NULL DEFAULT 40,
  school_year        TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (name, school_year)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id  INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  school_year TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  strand      TEXT,
  status      TEXT NOT NULL DEFAULT 'enrolled',
  enrolled_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, school_year)
);

CREATE TABLE IF NOT EXISTS attendance (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id  INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  date        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'present',
  time_in     TEXT,
  time_out    TEXT,
  remarks     TEXT,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, date)
);

CREATE TABLE IF NOT EXISTS grades (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id       INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  section_id       INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  school_year      TEXT NOT NULL,
  quarter          INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  written_work     REAL,
  performance_task REAL,
  quarterly_exam   REAL,
  computed_grade   REAL,
  remarks          TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, subject_id, school_year, quarter)
);

CREATE TABLE IF NOT EXISTS announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  audience   TEXT NOT NULL DEFAULT 'all',
  priority   TEXT NOT NULL DEFAULT 'normal',
  author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username   TEXT,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  details    TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('grade_weights', '{"written_work":25,"performance_task":45,"quarterly_exam":30}');

CREATE INDEX IF NOT EXISTS idx_students_name   ON students (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_enrollments_sec ON enrollments (section_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (date);
CREATE INDEX IF NOT EXISTS idx_grades_student  ON grades (student_id, school_year, quarter);

CREATE TABLE IF NOT EXISTS class_assignments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  school_year      TEXT NOT NULL,
  section_id       INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id       INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id       INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  meetings_per_week INTEGER NOT NULL DEFAULT 1,
  room             TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (school_year, section_id, subject_id)
);

CREATE TABLE IF NOT EXISTS schedule_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  school_year TEXT NOT NULL,
  section_id  INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id  INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  day         INTEGER NOT NULL CHECK (day BETWEEN 1 AND 5),
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  room        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_schedule_year    ON schedule_entries (school_year, day, start_time);
CREATE INDEX IF NOT EXISTS idx_schedule_teacher ON schedule_entries (teacher_id, day, start_time);

CREATE TABLE IF NOT EXISTS report_types (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  group_name  TEXT NOT NULL,
  frequency   TEXT NOT NULL DEFAULT 'periodic',
  is_deped_form INTEGER NOT NULL DEFAULT 0,
  auto_generate INTEGER NOT NULL DEFAULT 0,
  required    INTEGER NOT NULL DEFAULT 1,
  active      INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submission_workflows (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type_id INTEGER NOT NULL UNIQUE REFERENCES report_types(id) ON DELETE CASCADE,
  review_roles  TEXT NOT NULL DEFAULT '[]',
  approve_roles TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS report_submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type_id INTEGER NOT NULL REFERENCES report_types(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id   INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  school_year  TEXT NOT NULL,
  period       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft',
  notes        TEXT,
  due_date     TEXT,
  draft_body   TEXT,
  reviewer_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  review_note  TEXT,
  reviewed_at  TEXT,
  approver_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subm_user   ON report_submissions (user_id, school_year);
CREATE INDEX IF NOT EXISTS idx_subm_status ON report_submissions (school_year, status);
CREATE INDEX IF NOT EXISTS idx_subm_type   ON report_submissions (report_type_id, school_year);

CREATE TABLE IF NOT EXISTS submission_files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES report_submissions(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  mime          TEXT,
  uploaded_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
