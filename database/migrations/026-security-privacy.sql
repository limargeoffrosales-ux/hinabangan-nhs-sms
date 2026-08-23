-- Data retention policies
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id            BIGSERIAL PRIMARY KEY,
  entity        TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL DEFAULT 365,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  description   TEXT,
  last_purged_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default retention policies (RA 10173 requires no longer than necessary)
INSERT INTO data_retention_policies (entity, retention_days, description) VALUES
  ('audit_logs', 730, 'Audit trail — retained for 2 years per RA 10173'),
  ('doc_generations', 30, 'AI-generated documents — ephemeral, purged weekly'),
  ('doc_formats', 30, 'AI document formats — ephemeral'),
  ('attendance', 1825, 'Attendance records — retained for 5 years (DepEd requirement)'),
  ('grades', 1825, 'Grade records — retained for 5 years'),
  ('consent_responses', 3650, 'Consent signatures — retained for 10 years (legal hold)'),
  ('notifications', 90, 'Notification delivery logs — 90 days'),
  ('refresh_tokens', 30, 'Session refresh tokens — 30 days')
ON CONFLICT (entity) DO NOTHING;

-- Data erasure requests (right-to-erasure workflow)
CREATE TABLE IF NOT EXISTS data_erasure_requests (
  id            BIGSERIAL PRIMARY KEY,
  student_id    BIGINT REFERENCES students(id) ON DELETE SET NULL,
  requested_by  BIGINT REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'pending',
  reason        TEXT,
  exported_json TEXT,
  processed_by  BIGINT REFERENCES users(id),
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MFA (TOTP) secrets
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT now();

-- Password policy settings (stored in app_settings, seeded defaults)
INSERT INTO app_settings (key, value) VALUES
  ('password_min_length', '12'),
  ('password_require_uppercase', 'true'),
  ('password_require_lowercase', 'true'),
  ('password_require_digit', 'true'),
  ('password_require_special', 'true'),
  ('password_max_age_days', '90'),
  ('mfa_required_roles', '["super_admin","school_admin"]')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_erasure_status ON data_erasure_requests(status);
