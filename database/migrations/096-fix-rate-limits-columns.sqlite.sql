-- No-op migration for SQLite to match PG migration count
-- PG migration 096 fixes rate_limits columns (already correct in SQLite migration 093)
-- This is a no-op placeholder to keep migration counts in sync
SELECT 'SQLite rate_limits schema already correct from migration 093' AS note;