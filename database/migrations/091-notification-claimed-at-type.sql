-- 091-notification-claimed-at-type.sql
-- Postgres variant: repair the column type for databases that already applied
-- the original 090.
--
-- 090 shipped `claimed_at` as TEXT. notify.js writes it with nowSql() ('now()' on
-- PG) and the sweep reads it against `now() - interval '10 minutes'`, so on a
-- TEXT column PostgreSQL refuses the assignment
-- ("column is of type text but expression is of type timestamp with time zone")
-- and the stuck-claim recovery query fails with "operator does not exist:
-- text < timestamp".
--
-- Editing 090 is not enough: migrations already recorded in schema_migrations
-- are never re-run, so every environment that applied the original file keeps
-- TEXT until an explicitly new migration fixes it. 090 itself is already
-- corrected for fresh installs, which is why this step must be conditional.
--
-- Safe to run on a fresh database: the type guard simply finds TIMESTAMPTZ and
-- skips the conversion.

-- 1. Blanking unparseable values BEFORE the type change. A single junk row would
--    otherwise abort the ALTER and roll back the whole migration, and because
--    the migration runs inside one transaction it would also roll back the
--    INSERT that records this file, so the boot would crash-loop forever.
--    A claimed_at we cannot read is equivalent to "no claim": the sweep treats
--    NULL as unclaimed and re-queues the row, which is the correct outcome.
UPDATE notifications
   SET claimed_at = NULL
 WHERE claimed_at IS NOT NULL
   AND btrim(claimed_at::text) !~ '^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$';

-- 2. Convert only when the column is still text/varchar.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'notifications'
       AND column_name = 'claimed_at'
       AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE notifications
      ALTER COLUMN claimed_at TYPE TIMESTAMPTZ
      USING NULLIF(btrim(claimed_at::text), '')::timestamptz;
  END IF;
END
$do$;

-- 3. The claim index backs the sweep's queue read; 090 creates it too but it is
--    repeated here as IF NOT EXISTS so a database that applied a partial 090
--    still ends up with it.
CREATE INDEX IF NOT EXISTS idx_notifications_claim
  ON notifications (status, attempts, created_at);