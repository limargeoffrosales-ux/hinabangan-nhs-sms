-- ============================================================
-- MeridianEd — AI & Intelligence modules (PostgreSQL)
-- Structural mirror of 002-ai-modules.sqlite.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS research_projects (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  research_type TEXT NOT NULL DEFAULT 'Action Research',
  status        TEXT NOT NULL DEFAULT 'draft',
  abstract      TEXT,
  methodology   TEXT,
  findings      TEXT,
  conclusion    TEXT,
  funding_source TEXT,
  timeline_start TEXT,
  timeline_end   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_versions (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  version_no  INTEGER NOT NULL,
  content     TEXT,
  note        TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_milestones (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  milestone   TEXT NOT NULL,
  target_date TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learner_assessments (
  id              SERIAL PRIMARY KEY,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL DEFAULT 'reading',
  assessment_type TEXT NOT NULL DEFAULT 'PHIL-IRI',
  date            TEXT NOT NULL,
  score           REAL,
  max_score       REAL,
  level           TEXT,
  fluency         TEXT,
  comprehension   TEXT,
  remarks         TEXT,
  recorded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, kind, assessment_type, date)
);

CREATE TABLE IF NOT EXISTS intervention_plans (
  id             SERIAL PRIMARY KEY,
  student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT 'academic_recovery',
  strategy       TEXT,
  frequency      TEXT,
  start_date     TEXT,
  end_date       TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  progress_notes TEXT,
  recorded_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intervention_contacts (
  id           SERIAL PRIMARY KEY,
  plan_id      INTEGER NOT NULL REFERENCES intervention_plans(id) ON DELETE CASCADE,
  mode         TEXT NOT NULL DEFAULT 'meeting',
  summary      TEXT,
  contact_date TEXT NOT NULL,
  recorded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_bank (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id  INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  grade_level TEXT,
  competency  TEXT,
  qtype       TEXT NOT NULL DEFAULT 'mcq',
  question    TEXT NOT NULL,
  options     TEXT,
  answer      TEXT,
  difficulty  INTEGER NOT NULL DEFAULT 2,
  used_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rubrics (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  task       TEXT,
  criteria   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tos_records (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  quarter    INTEGER NOT NULL DEFAULT 1,
  data       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS item_analyses (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  school_year TEXT NOT NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  total_items INTEGER NOT NULL DEFAULT 0,
  learners   INTEGER NOT NULL DEFAULT 0,
  data       TEXT,
  computed   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_chat_logs (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  message    TEXT NOT NULL,
  intent     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_user  ON research_projects (user_id, status);
CREATE INDEX IF NOT EXISTS idx_assess_student ON learner_assessments (student_id, kind);
CREATE INDEX IF NOT EXISTS idx_interv_student ON intervention_plans (student_id, status);
CREATE INDEX IF NOT EXISTS idx_qbank_subject  ON question_bank (subject_id, competency);