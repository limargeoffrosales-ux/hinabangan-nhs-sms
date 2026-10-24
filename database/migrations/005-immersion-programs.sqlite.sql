-- ============================================================
-- 005: Immersion & programs modules (SQLite mirror)
-- Teacher daily attendance, Work Immersion, JDVP recipients
-- ============================================================

CREATE TABLE IF NOT EXISTS teacher_attendance (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'present',
  remarks     TEXT,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (teacher_id, date)
);

CREATE TABLE IF NOT EXISTS work_immersion (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id         INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch              TEXT NOT NULL,
  program            TEXT NOT NULL DEFAULT 'Academic',
  partner_institution TEXT,
  status             TEXT NOT NULL DEFAULT 'ongoing',
  start_date         TEXT,
  end_date           TEXT,
  remarks            TEXT,
  recorded_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, batch, program)
);
CREATE INDEX IF NOT EXISTS idx_immersion_batch ON work_immersion (batch, program);

CREATE TABLE IF NOT EXISTS jdvp_recipients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch       TEXT NOT NULL,
  program     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  remarks     TEXT,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, batch)
);
CREATE INDEX IF NOT EXISTS idx_jdvp_batch ON jdvp_recipients (batch);