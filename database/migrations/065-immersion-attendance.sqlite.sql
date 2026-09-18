-- ============================================================
-- 065: Work Immersion daily attendance (SQLite mirror)
-- Daily Time Record per immersion placement
-- ============================================================

CREATE TABLE IF NOT EXISTS immersion_attendance (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  immersion_id INTEGER NOT NULL REFERENCES work_immersion(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'present',
  time_in     TEXT,
  time_out    TEXT,
  hours       REAL,
  remarks     TEXT,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (immersion_id, date)
);
CREATE INDEX IF NOT EXISTS idx_immersion_attendance_date ON immersion_attendance (date);