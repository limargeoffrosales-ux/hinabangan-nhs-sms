-- ============================================================
-- 065 (SQLite): Work Immersion Tracking System
-- Student attendance, performance, security, venue tracking
-- ============================================================

-- Add additional columns to existing work_immersion table
ALTER TABLE work_immersion ADD COLUMN grade_level TEXT;
ALTER TABLE work_immersion ADD COLUMN strand TEXT;
ALTER TABLE work_immersion ADD COLUMN total_hours INTEGER DEFAULT 0;
ALTER TABLE work_immersion ADD COLUMN consent_status TEXT DEFAULT 'pending';
ALTER TABLE work_immersion ADD COLUMN parent_name TEXT;
ALTER TABLE work_immersion ADD COLUMN parent_contact TEXT;

-- ============================================================
-- work_immersion_venues - Partner institution tracking
-- (created first: attendance/performance/issues/reports FK to it)
-- ============================================================
CREATE TABLE IF NOT EXISTS work_immersion_venues (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  institution_type TEXT,
  address          TEXT,
  lat              REAL,
  lng              REAL,
  contact_person   TEXT,
  contact_phone    TEXT,
  email            TEXT,
  safety_rating    TEXT, -- excellent, good, satisfactory, needs_improvement
  security_level   TEXT, -- low, medium, high
  status           TEXT NOT NULL DEFAULT 'active',
  inspection_date  DATE,
  next_inspection  DATE,
  notes            TEXT,
  noted_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- work_immersion_attendance - Daily student attendance tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS work_immersion_attendance (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  venue_id         INTEGER REFERENCES work_immersion_venues(id) ON DELETE SET NULL,
  date             DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'present',
  arrival_time     TEXT,
  departure_time   TEXT,
  hours_worked     INTEGER DEFAULT 0,
  remarks          TEXT,
  recorded_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, date, venue_id)
);

-- ============================================================
-- work_immersion_performance - Student performance appraisal
-- ============================================================
CREATE TABLE IF NOT EXISTS work_immersion_performance (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  venue_id         INTEGER REFERENCES work_immersion_venues(id) ON DELETE SET NULL,
  appraisal_date   DATE NOT NULL,
  performance_level TEXT NOT NULL, -- outstanding, satisfactory, needs_improvement
  competency_rating TEXT,
  attendance_rate  INTEGER DEFAULT 0,
  hours_completed  INTEGER DEFAULT 0,
  strengths        TEXT,
  areas_for_improvement TEXT,
  evaluated_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, appraisal_date)
);

-- ============================================================
-- work_immersion_issues - Security and concern reporting
-- ============================================================
CREATE TABLE IF NOT EXISTS work_immersion_issues (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  venue_id         INTEGER REFERENCES work_immersion_venues(id) ON DELETE SET NULL,
  issue_type       TEXT NOT NULL, -- safety, security, behavioral, academic, other
  severity         TEXT NOT NULL, -- low, medium, high, critical
  description      TEXT NOT NULL,
  reported_date    DATE NOT NULL,
  resolved         INTEGER NOT NULL DEFAULT 0,
  resolved_date    DATE,
  resolved_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reported_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- work_immersion_reports - Teacher submission reports
-- ============================================================
CREATE TABLE IF NOT EXISTS work_immersion_reports (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id         INTEGER REFERENCES work_immersion_venues(id) ON DELETE SET NULL,
  report_date      DATE NOT NULL,
  period_covered   TEXT,
  students_count   INTEGER DEFAULT 0,
  attendance_rate  INTEGER DEFAULT 0,
  performance_summary TEXT,
  issues_raised    TEXT,
  recommendations  TEXT,
  submitted        INTEGER NOT NULL DEFAULT 0,
  submitted_at     TIMESTAMP,
  submitted_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON work_immersion_attendance (student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_venue ON work_immersion_attendance (venue_id, date);
CREATE INDEX IF NOT EXISTS idx_performance_student ON work_immersion_performance (student_id);
CREATE INDEX IF NOT EXISTS idx_issues_student ON work_immersion_issues (student_id);
CREATE INDEX IF NOT EXISTS idx_issues_venue ON work_immersion_issues (venue_id);
CREATE INDEX IF NOT EXISTS idx_issues_resolved ON work_immersion_issues (resolved);
CREATE INDEX IF NOT EXISTS idx_venues_status ON work_immersion_venues (status);
CREATE INDEX IF NOT EXISTS idx_reports_teacher ON work_immersion_reports (teacher_id);
CREATE INDEX IF NOT EXISTS idx_reports_venue ON work_immersion_reports (venue_id);