-- 082-notification-simulated-status.sqlite.sql
-- SQLite variant: widen the notifications status CHECK to include 'simulated'
-- (SMS simulator mode records messages that went through the delivery pipeline
--  while no real gateway was configured — never marked as truly 'sent').

CREATE TABLE IF NOT EXISTS notifications_sim_table (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  event              TEXT NOT NULL,
  channel            TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recipient_address  TEXT NOT NULL,
  subject            TEXT,
  body               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'simulated')),
  attempts           INTEGER NOT NULL DEFAULT 0,
  provider_id        TEXT,
  error              TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at            TEXT
);

INSERT INTO notifications_sim_table
  (id, event, channel, recipient_user_id, recipient_address, subject, body, status, attempts, provider_id, error, created_at, updated_at, sent_at)
  SELECT id, event, channel, recipient_user_id, recipient_address, subject, body, status, attempts, provider_id, error, created_at, updated_at, sent_at
  FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications_sim_table RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_notifications_retry ON notifications (status, attempts, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications (event, created_at DESC);