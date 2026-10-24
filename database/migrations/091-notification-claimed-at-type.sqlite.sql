-- 091-notification-claimed-at-type.sqlite.sql
-- SQLite variant: claimed_at is already TEXT here, matching created_at, sent_at
-- and updated_at, and the sweep compares it with datetime('now', '-10 minutes').
-- A TEXT ISO-8601 string sorts and compares correctly against that expression,
-- so there is NO type change to make on SQLite.
--
-- What this step does do is normalise rows a pre-090 build may have written in
-- some other format. datetime() returns NULL for a value it cannot parse, which
-- would make `claimed_at < datetime(...)` evaluate to NULL, so a stuck claim
-- would never be reclaimed. Clearing those rows to NULL hands them back to the
-- queue, which is the correct outcome for an unreadable claim.
UPDATE notifications
   SET claimed_at = NULL
 WHERE claimed_at IS NOT NULL
   AND (trim(claimed_at) = ''
        OR trim(claimed_at) NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*');

-- Idempotent; 090 already creates it on fresh installs.
CREATE INDEX IF NOT EXISTS idx_notifications_claim
  ON notifications (status, attempts, created_at);