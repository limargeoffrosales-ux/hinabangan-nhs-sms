-- ============================================================
-- 010: Student Conduct & Discipline (PostgreSQL)
-- student_conduct_records = one reported incident / call slip per learner
-- conduct_case_actions = the actions/interventions taken on a case (timeline)
-- ============================================================

CREATE TABLE IF NOT EXISTS student_conduct_records (
  id            BIGSERIAL PRIMARY KEY,
  student_id    BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL,
  incident_date DATE NOT NULL,
  description   TEXT,
  severity      TEXT NOT NULL DEFAULT 'minor',
  status        TEXT NOT NULL DEFAULT 'open',
  reported_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conduct_case_actions (
  id          BIGSERIAL PRIMARY KEY,
  record_id   BIGINT NOT NULL REFERENCES student_conduct_records(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_date DATE NOT NULL,
  notes       TEXT,
  done_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conduct_student ON student_conduct_records (student_id);
CREATE INDEX IF NOT EXISTS idx_conduct_status ON student_conduct_records (status, incident_date);
CREATE INDEX IF NOT EXISTS idx_conduct_type ON student_conduct_records (incident_type);
CREATE INDEX IF NOT EXISTS idx_conduct_actions_record ON conduct_case_actions (record_id);
