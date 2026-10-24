-- 082-notification-simulated-status.sql
-- Postgres variant: widen the notifications status CHECK to include 'simulated'
-- (SMS simulator mode records messages that went through the delivery pipeline
--  while no real gateway was configured — never marked as truly 'sent').

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_status_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_status_check
  CHECK (status IN ('queued', 'sent', 'failed', 'simulated'));