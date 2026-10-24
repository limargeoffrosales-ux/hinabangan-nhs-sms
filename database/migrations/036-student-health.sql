-- Migration 036: Add student_health table for SF8 (Health & Nutrition Report)
-- Stores height, weight, BMI, nutritional status, and CCT per student per school year

CREATE TABLE IF NOT EXISTS student_health (
  id                   BIGSERIAL PRIMARY KEY,
  student_id           BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year          TEXT NOT NULL,
  section_id           BIGINT REFERENCES sections(id) ON DELETE SET NULL,
  height_cm            NUMERIC(5,1),
  weight_kg            NUMERIC(5,2),
  bmi                  NUMERIC(4,1),
  nutritional_status   TEXT,
  cct                  BOOLEAN DEFAULT FALSE,
  remarks              TEXT,
  recorded_by          BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, school_year)
);

CREATE INDEX IF NOT EXISTS idx_student_health_student ON student_health(student_id);
CREATE INDEX IF NOT EXISTS idx_student_health_section ON student_health(section_id);
CREATE INDEX IF NOT EXISTS idx_student_health_year     ON student_health(school_year);
