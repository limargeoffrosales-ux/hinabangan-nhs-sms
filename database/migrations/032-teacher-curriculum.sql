-- Migration 032: Teacher curriculum features
-- Lessons, per-competency scores, competency-aligned assessments

CREATE TABLE IF NOT EXISTS lessons (
  id              BIGSERIAL PRIMARY KEY,
  teacher_id      BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id      BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  section_id      BIGINT REFERENCES sections(id) ON DELETE SET NULL,
  school_year     TEXT NOT NULL,
  quarter         INTEGER CHECK (quarter BETWEEN 1 AND 4),
  title           TEXT NOT NULL,
  objectives      TEXT,
  content_outline TEXT,
  teaching_strategy TEXT,
  materials       TEXT,
  assessment_plan TEXT,
  competency_ids  TEXT DEFAULT '[]',
  duration_minutes INTEGER DEFAULT 60,
  scheduled_date  DATE,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'taught', 'revised')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_competency_scores (
  id              BIGSERIAL PRIMARY KEY,
  student_id      BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  competency_id   BIGINT NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  subject_id      BIGINT REFERENCES subjects(id) ON DELETE SET NULL,
  section_id      BIGINT REFERENCES sections(id) ON DELETE SET NULL,
  school_year     TEXT NOT NULL,
  quarter         INTEGER CHECK (quarter BETWEEN 1 AND 4),
  score           NUMERIC(5,2),
  level           TEXT CHECK (level IN ('Beginning', 'Developing', 'Approaching Proficiency', 'Proficient', 'Advanced')),
  evidence        TEXT,
  assessed_by     BIGINT REFERENCES teachers(id) ON DELETE SET NULL,
  assessed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, competency_id, subject_id, school_year, quarter)
);

ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS competency_id BIGINT REFERENCES competencies(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS competency_id BIGINT REFERENCES competencies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_teacher ON lessons(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lessons_subject ON lessons(subject_id);
CREATE INDEX IF NOT EXISTS idx_lessons_section ON lessons(section_id);
CREATE INDEX IF NOT EXISTS idx_scs_student ON student_competency_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_scs_competency ON student_competency_scores(competency_id);
CREATE INDEX IF NOT EXISTS idx_scs_subject ON student_competency_scores(subject_id);
