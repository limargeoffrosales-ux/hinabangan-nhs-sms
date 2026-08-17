-- Account lockout columns on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Security incident log (separate from audit_logs — focused on security events)
CREATE TABLE IF NOT EXISTS security_incidents (
  id            BIGSERIAL PRIMARY KEY,
  incident_type TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'low',
  source_ip     TEXT,
  username      TEXT,
  user_id       BIGINT,
  details       JSONB,
  resolved      BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by   BIGINT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_si_type ON security_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_si_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_si_created ON security_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_si_unresolved ON security_incidents(resolved) WHERE NOT resolved;

-- Request ID tracking (stored in app_settings for config)
INSERT INTO app_settings (key, value) VALUES
  ('lockout_max_attempts', '5'),
  ('lockout_duration_minutes', '15'),
  ('incident_retention_days', '365')
ON CONFLICT (key) DO NOTHING;
