-- Migration 032: Teacher curriculum features (SQLite)
-- Lessons, per-competency scores, competency-aligned assessments

CREATE TABLE IF NOT EXISTS lessons (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id      INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  section_id      INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  school_year     TEXT NOT NULL,
  quarter         INTEGER,
  title           TEXT NOT NULL,
  objectives      TEXT,
  content_outline TEXT,
  teaching_strategy TEXT,
  materials       TEXT,
  assessment_plan TEXT,
  competency_ids  TEXT DEFAULT '[]',
  duration_minutes INTEGER DEFAULT 60,
  scheduled_date  TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_competency_scores (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  competency_id   INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  subject_id      INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  section_id      INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  school_year     TEXT NOT NULL,
  quarter         INTEGER,
  score           REAL,
  level           TEXT,
  evidence        TEXT,
  assessed_by     INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  assessed_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, competency_id, subject_id, school_year, quarter)
);

ALTER TABLE question_bank ADD COLUMN competency_id INTEGER REFERENCES competencies(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN competency_id INTEGER REFERENCES competencies(id) ON DELETE SET NULL;
