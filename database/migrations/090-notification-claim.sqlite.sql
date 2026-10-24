-- 090-notification-claim.sqlite.sql
-- SQLite variant: rebuild notifications to add an in-flight 'sending' status
-- and a claimed_at stamp. SQLite cannot ALTER a CHECK constraint, so the table
-- is recreated (same pattern as 082) with the indexes restored afterwards.

CREATE TABLE IF NOT EXISTS notifications_claim_table (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  event              TEXT NOT NULL,
  channel            TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recipient_address  TEXT NOT NULL,
  subject            TEXT,
  body               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'simulated')),
  attempts           INTEGER NOT NULL DEFAULT 0,
  provider_id        TEXT,
  error              TEXT,
  claimed_at         TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at            TEXT
);

INSERT INTO notifications_claim_table
  (id, event, channel, recipient_user_id, recipient_address, subject, body, status, attempts, provider_id, error, claimed_at, created_at, updated_at, sent_at)
  SELECT id, event, channel, recipient_user_id, recipient_address, subject, body, status, attempts, provider_id, error, NULL, created_at, updated_at, sent_at
  FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications_claim_table RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_notifications_retry ON notifications (status, attempts, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_claim ON notifications (status, attempts, created_at);
