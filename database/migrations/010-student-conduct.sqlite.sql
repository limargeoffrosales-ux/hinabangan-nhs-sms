-- ============================================================
-- 010: Student Conduct & Discipline (SQLite mirror)
-- student_conduct_records = one reported incident / call slip per learner
-- conduct_case_actions = the actions/interventions taken on a case (timeline)
-- ============================================================

CREATE TABLE IF NOT EXISTS student_conduct_records (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL,
  incident_date TEXT NOT NULL,
  description   TEXT,
  severity      TEXT NOT NULL DEFAULT 'minor',
  status        TEXT NOT NULL DEFAULT 'open',
  reported_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conduct_case_actions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id   INTEGER NOT NULL REFERENCES student_conduct_records(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_date TEXT NOT NULL,
  notes       TEXT,
  done_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conduct_student ON student_conduct_records (student_id);
CREATE INDEX IF NOT EXISTS idx_conduct_status ON student_conduct_records (status, incident_date);
CREATE INDEX IF NOT EXISTS idx_conduct_type ON student_conduct_records (incident_type);
CREATE INDEX IF NOT EXISTS idx_conduct_actions_record ON conduct_case_actions (record_id);
