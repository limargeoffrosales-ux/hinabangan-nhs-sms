-- 090-notification-claim.sql
-- Postgres variant: add an in-flight 'sending' status plus a claimed_at stamp so
-- the background sweep can atomically claim a queued row before sending.
--
-- Previously the sweep SELECTed queued rows and sent them afterwards. Two sweeps
-- (or a sweep racing an explicit resend) could both pick up the same row and send
-- the email/SMS twice, because nothing marked the row as in-flight between the
-- SELECT and the provider call.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_status_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_status_check
  CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'simulated'));

-- TIMESTAMPTZ, matching created_at/updated_at/sent_at in 023-notifications.sql.
-- This MUST NOT be TEXT: notify.js writes it with nowSql() ('now()' on PG) and
-- reads it against `now() - interval '10 minutes'` to reclaim stuck rows. With
-- TEXT, PostgreSQL rejects the assignment ("column is of type text but
-- expression is of type timestamp with time zone") and the recovery sweep fails
-- with "operator does not exist: text < timestamp".
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_claim
  ON notifications (status, attempts, created_at);
