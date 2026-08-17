-- For SQLite: Store MFA settings separately since ALTER TABLE ADD COLUMN IF NOT EXISTS isn't supported
CREATE TABLE IF NOT EXISTS user_mfa (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mfa_enabled   INTEGER NOT NULL DEFAULT 0,
  mfa_secret    TEXT
);

CREATE TABLE IF NOT EXISTS data_retention_policies (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entity        TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL DEFAULT 365,
  enabled       INTEGER NOT NULL DEFAULT 1,
  description   TEXT,
  last_purged_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default retention policies (RA 10173 requires no longer than necessary)
INSERT OR IGNORE INTO data_retention_policies (entity, retention_days, description) VALUES
  ('audit_logs', 730, 'Audit trail — retained for 2 years per RA 10173'),
  ('doc_generations', 30, 'AI-generated documents — ephemeral, purged weekly'),
  ('doc_formats', 30, 'AI document formats — ephemeral'),
  ('attendance', 1825, 'Attendance records — retained for 5 years (DepEd requirement)'),
  ('grades', 1825, 'Grade records — retained for 5 years'),
  ('consent_responses', 3650, 'Consent signatures — retained for 10 years (legal hold)'),
  ('notification_logs', 90, 'Notification delivery logs — 90 days'),
  ('refresh_tokens', 30, 'Session refresh tokens — 30 days');

-- Data erasure requests (right-to-erasure workflow)
CREATE TABLE IF NOT EXISTS data_erasure_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    INTEGER REFERENCES students(id) ON DELETE SET NULL,
  requested_by  INTEGER REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'pending',
  reason        TEXT,
  exported_json TEXT,
  processed_by  INTEGER REFERENCES users(id),
  processed_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Password policy settings (stored in app_settings, seeded defaults)
INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('password_min_length', '12'),
  ('password_require_uppercase', 'true'),
  ('password_require_lowercase', 'true'),
  ('password_require_digit', 'true'),
  ('password_require_special', 'true'),
  ('password_max_age_days', '90'),
  ('mfa_required_roles', '["super_admin","school_admin"]');

CREATE INDEX IF NOT EXISTS idx_erasure_status ON data_erasure_requests(status);
