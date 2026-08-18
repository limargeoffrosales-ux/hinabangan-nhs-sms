-- Migration 035 (SQLite): Add room_id FK to schedule_entries + cleanup
-- SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we just add the column

-- ── Add room_id to schedule_entries ────────────────────────────────
ALTER TABLE schedule_entries ADD COLUMN room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL;

-- Backfill room_id from room TEXT by matching rooms.name
UPDATE schedule_entries
   SET room_id = (SELECT r.id FROM rooms r WHERE schedule_entries.room = r.name)
 WHERE room_id IS NULL;

-- Drop orphaned user_mfa table (dead since 034 added columns to users directly)
DROP TABLE IF EXISTS user_mfa;
