-- Password audit trail — tracks all password creation, resets, and changes
CREATE TABLE IF NOT EXISTS password_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  ip_address  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pa_user ON password_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_pa_action ON password_audit(action);
CREATE INDEX IF NOT EXISTS idx_pa_created ON password_audit(created_at);
