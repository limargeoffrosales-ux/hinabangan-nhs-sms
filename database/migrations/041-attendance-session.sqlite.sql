-- 041: Add session (AM/PM) to attendance for SF2 DepEd compliance (SQLite)
-- SQLite doesn't support ALTER COLUMN or DROP CONSTRAINT on UNIQUE,
-- so we recreate the table.

CREATE TABLE IF NOT EXISTS attendance_new (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id   INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  date         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'present',
  session      TEXT DEFAULT NULL,
  time_in      TEXT,
  time_out     TEXT,
  remarks      TEXT,
  recorded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO attendance_new (id, student_id, section_id, date, status, time_in, time_out, remarks, recorded_by, created_at)
  SELECT id, student_id, section_id, date, status, time_in, time_out, remarks, recorded_by, created_at
  FROM attendance;

DROP TABLE IF EXISTS attendance;
ALTER TABLE attendance_new RENAME TO attendance;

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_student_date_session
  ON attendance (student_id, date, session);
CREATE INDEX IF NOT EXISTS idx_attendance_section_date ON attendance (section_id, date);
