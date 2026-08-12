-- ============================================================
-- 009: ARAL Program — remediation session tracking (SQLite mirror)
-- aral_sessions = one remediation/tutoring session per section
-- aral_session_attendance = per-learner status within a session
-- ============================================================

CREATE TABLE IF NOT EXISTS aral_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  school_year  TEXT NOT NULL,
  section_id   INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_area TEXT NOT NULL DEFAULT 'reading',
  session_date TEXT NOT NULL,
  session_no   INTEGER,
  tutor        TEXT,
  remarks      TEXT,
  recorded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS aral_session_attendance (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES aral_sessions(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'present',
  remarks    TEXT,
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_aral_sessions_area ON aral_sessions (subject_area, session_date);
CREATE INDEX IF NOT EXISTS idx_aral_sessions_section ON aral_sessions (section_id);
CREATE INDEX IF NOT EXISTS idx_aral_att_student ON aral_session_attendance (student_id);