-- ============================================================
-- 065: Work Immersion Tracking System
-- Student attendance, performance, security, venue tracking
-- ============================================================

-- Add additional columns to existing work_immersion table
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS grade_level TEXT;
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS strand TEXT;
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS total_hours INTEGER DEFAULT 0;
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS consent_status TEXT DEFAULT 'pending';
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS parent_name TEXT;
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS parent_contact TEXT;

-- ============================================================
-- work_immersion_venues - Partner institution tracking
-- (created first: attendance/performance/issues/reports FK to it)
-- ============================================================
CREATE TABLE IF NOT EXISTS work_immersion_venues (
  id               BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  institution_type TEXT, -- school, office, workshop, laboratory, etc.
  address          TEXT,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  contact_person   TEXT,
  contact_phone    TEXT,
  email            TEXT,
  safety_rating    TEXT, -- excellent, good, satisfactory, needs_improvement
  security_level   TEXT, -- low, medium, high
  status           TEXT NOT NULL DEFAULT 'active', -- active, suspended, closed
  inspection_date  DATE,
  next_inspection  DATE,
  notes            TEXT,
  noted_by         BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ
);

-- ============================================================
-- work_immersion_attendance - Daily student attendance tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS work_immersion_attendance (
  id               BIGSERIAL PRIMARY KEY,
  student_id       BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  venue_id         BIGINT REFERENCES work_immersion_venues(id) ON DELETE SET NULL,
  date             DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'present', -- present, absent, excused
  arrival_time     TIME,
  departure_time   TIME,
  hours_worked     INTEGER DEFAULT 0,
  remarks          TEXT,
  recorded_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date, venue_id)
);

-- ============================================================
-- work_immersion_performance - Student performance appraisal
-- ============================================================
CREATE TABLE IF NOT EXISTS work_immersion_performance (
  id               BIGSERIAL PRIMARY KEY,
  student_id       BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  venue_id         BIGINT REFERENCES work_immersion_venues(id) ON DELETE SET NULL,
  appraisal_date   DATE NOT NULL,
  performance_level TEXT NOT NULL, -- outstanding, satisfactory, needs_improvement
  competency_rating TEXT, -- communication, teamwork, technical skills, etc.
  attendance_rate  INTEGER DEFAULT 0, -- percentage
  hours_completed  INTEGER DEFAULT 0,
  strengths        TEXT,
  areas_for_improvement TEXT,
  evaluated_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, appraisal_date)
);

-- ============================================================
-- work_immersion_issues - Security and concern reporting
-- ============================================================
CREATE TABLE IF NOT EXISTS work_immersion_issues (
  id               BIGSERIAL PRIMARY KEY,
  student_id       BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  venue_id         BIGINT REFERENCES work_immersion_venues(id) ON DELETE SET NULL,
  issue_type       TEXT NOT NULL, -- safety, security, behavioral, academic, other
  severity         TEXT NOT NULL, -- low, medium, high, critical
  description      TEXT NOT NULL,
  reported_date    DATE NOT NULL,
  resolved         BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_date    DATE,
  resolved_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reported_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- work_immersion_reports - Teacher submission reports
-- ============================================================
CREATE TABLE IF NOT EXISTS work_immersion_reports (
  id               BIGSERIAL PRIMARY KEY,
  teacher_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id         BIGINT REFERENCES work_immersion_venues(id) ON DELETE SET NULL,
  report_date      DATE NOT NULL,
  period_covered   TEXT, -- e.g., "Week 1-2", "Month of October"
  students_count   INTEGER DEFAULT 0,
  attendance_rate  INTEGER DEFAULT 0,
  performance_summary TEXT,
  issues_raised    TEXT,
  recommendations  TEXT,
  submitted        BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at     TIMESTAMPTZ,
  submitted_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
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