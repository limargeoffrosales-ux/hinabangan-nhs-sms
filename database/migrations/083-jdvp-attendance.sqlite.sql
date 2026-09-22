CREATE TABLE IF NOT EXISTS jdvp_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jdvp_recipient_id INTEGER NOT NULL REFERENCES jdvp_recipients(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  time_in TEXT,
  time_out TEXT,
  hours REAL,
  remarks TEXT,
  recorded_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (jdvp_recipient_id, date)
);

CREATE INDEX IF NOT EXISTS idx_jdvp_attendance_recipient ON jdvp_attendance(jdvp_recipient_id);
CREATE INDEX IF NOT EXISTS idx_jdvp_attendance_date ON jdvp_attendance(date);
