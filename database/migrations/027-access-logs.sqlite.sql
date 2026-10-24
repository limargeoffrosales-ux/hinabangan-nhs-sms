CREATE TABLE IF NOT EXISTS data_access_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username      TEXT,
  student_id    INTEGER,
  action        TEXT NOT NULL DEFAULT 'STUDENT_VIEW',
  ip            TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dal_student ON data_access_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_dal_user ON data_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_dal_created ON data_access_logs(created_at);
