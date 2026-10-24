-- 023-notifications.sql
-- Postgres variant: Email/SMS notification engine (P1 — Communication & internationalization).
-- Delivery log/queue plus editable templates. Channel on/off toggles live in app_settings
-- (keys notify_email_enabled / notify_sms_enabled) so no extra config table is needed.

CREATE TABLE IF NOT EXISTS notifications (
  id               BIGSERIAL PRIMARY KEY,
  event            TEXT NOT NULL,
  channel          TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  recipient_address TEXT NOT NULL,
  subject          TEXT,
  body             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  provider_id      TEXT,
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notifications_retry ON notifications (status, attempts, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications (event, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_templates (
  id         BIGSERIAL PRIMARY KEY,
  event      TEXT NOT NULL,
  channel    TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  subject    TEXT,
  body       TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event, channel)
);
