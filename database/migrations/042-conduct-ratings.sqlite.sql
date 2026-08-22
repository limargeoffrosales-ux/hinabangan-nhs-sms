-- 042: Student conduct ratings for SF9 report card (SQLite)

CREATE TABLE IF NOT EXISTS student_conduct_ratings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year     TEXT NOT NULL,
  term            TEXT NOT NULL,
  makadiyos       TEXT DEFAULT NULL CHECK (makadiyos IN ('always','often','sometimes','rarely')),
  makatao         TEXT DEFAULT NULL CHECK (makatao IN ('always','often','sometimes','rarely')),
  makakalikasan   TEXT DEFAULT NULL CHECK (makakalikasan IN ('always','often','sometimes','rarely')),
  makabansa       TEXT DEFAULT NULL CHECK (makabansa IN ('always','often','sometimes','rarely')),
  remarks         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, school_year, term)
);

CREATE INDEX IF NOT EXISTS idx_conduct_rating_student ON student_conduct_ratings (student_id, school_year, term);
