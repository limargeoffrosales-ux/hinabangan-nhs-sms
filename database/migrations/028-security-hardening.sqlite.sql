-- Account lockout columns on users
ALTER TABLE users ADD COLUMN failed_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;

-- Security incident log
CREATE TABLE IF NOT EXISTS security_incidents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_type TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'low',
  source_ip     TEXT,
  username      TEXT,
  user_id       INTEGER,
  details       TEXT,
  resolved      INTEGER NOT NULL DEFAULT 0,
  resolved_by   INTEGER,
  resolved_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_si_type ON security_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_si_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_si_created ON security_incidents(created_at);

-- Request ID tracking
INSERT INTO app_settings (key, value) VALUES
  ('lockout_max_attempts', '5'),
  ('lockout_duration_minutes', '15'),
  ('incident_retention_days', '365')
ON CONFLICT (key) DO NOTHING;
