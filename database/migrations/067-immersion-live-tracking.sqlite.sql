-- ============================================================
-- 067 (SQLite): Work Immersion live-location tracking
-- Optional opt-in GPS check-ins from students' phones during
-- immersion hours. Staff see the latest check-in per student.
-- ============================================================

CREATE TABLE IF NOT EXISTS work_immersion_tracking (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  immersion_id INTEGER NOT NULL REFERENCES work_immersion(id) ON DELETE CASCADE,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  accuracy_m  INTEGER,
  source      TEXT NOT NULL DEFAULT 'device', -- device, manual, map
  reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Latest check-in per student is the hot lookup for the live map.
CREATE INDEX IF NOT EXISTS idx_wit_student_time ON work_immersion_tracking (student_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_wit_immersion_time ON work_immersion_tracking (immersion_id, captured_at DESC);