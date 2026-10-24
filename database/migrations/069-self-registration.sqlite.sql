-- 069-self-registration.sqlite.sql
-- See 069-self-registration.sql for the rationale. SQLite dialect mirror.

CREATE TABLE IF NOT EXISTS student_link_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  verified   TEXT NOT NULL DEFAULT '[]',      -- JSON array of matched fields (lrn/birth_date/last_name)
  email      TEXT,
  phone      TEXT,
  notes      TEXT,
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- At most one live (pending) request per learner and per account.
CREATE UNIQUE INDEX IF NOT EXISTS idx_link_req_pending_student ON student_link_requests (student_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_link_req_pending_user ON student_link_requests (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_link_req_status ON student_link_requests (status, created_at DESC);

-- Public self-registration on/off switch (1 = open, 0 = closed).
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('registration_enabled', '1');