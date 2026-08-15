-- 023-notifications.sqlite.sql
-- SQLite variant: Email/SMS notification engine (P1 — Communication & internationalization).

CREATE TABLE IF NOT EXISTS notifications (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  event            TEXT NOT NULL,
  channel          TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recipient_address TEXT NOT NULL,
  subject          TEXT,
  body             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  provider_id      TEXT,
  error            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at          TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_retry ON notifications (status, attempts, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications (event, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event      TEXT NOT NULL,
  channel    TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  subject    TEXT,
  body       TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event, channel)
);
