-- Migration 036: Add student_health table for SF8 (SQLite version)

CREATE TABLE IF NOT EXISTS student_health (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id           INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year          TEXT NOT NULL,
  section_id           INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  height_cm            REAL,
  weight_kg            REAL,
  bmi                  REAL,
  nutritional_status   TEXT,
  cct                  INTEGER DEFAULT 0,
  remarks              TEXT,
  recorded_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, school_year)
);

CREATE INDEX IF NOT EXISTS idx_student_health_student ON student_health(student_id);
CREATE INDEX IF NOT EXISTS idx_student_health_section ON student_health(section_id);
CREATE INDEX IF NOT EXISTS idx_student_health_year     ON student_health(school_year);
