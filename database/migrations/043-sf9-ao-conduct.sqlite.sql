-- 043: Update conduct ratings to AO/SO/RO/NO (SQLite)
-- SQLite doesn't support DROP CONSTRAINT, so recreate the table

CREATE TABLE IF NOT EXISTS student_conduct_ratings_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year     TEXT NOT NULL,
  term            TEXT NOT NULL,
  makadiyos       TEXT DEFAULT NULL CHECK (makadiyos IN ('ao','so','ro','no')),
  makatao         TEXT DEFAULT NULL CHECK (makatao IN ('ao','so','ro','no')),
  makakalikasan   TEXT DEFAULT NULL CHECK (makakalikasan IN ('ao','so','ro','no')),
  makabansa       TEXT DEFAULT NULL CHECK (makabansa IN ('ao','so','ro','no')),
  remarks         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, school_year, term)
);

INSERT INTO student_conduct_ratings_new (id, student_id, school_year, term, makadiyos, makatao, makakalikasan, makabansa, remarks, created_at, updated_at)
SELECT id, student_id, school_year, term,
  CASE makadiyos WHEN 'always' THEN 'ao' WHEN 'often' THEN 'so' WHEN 'sometimes' THEN 'ro' WHEN 'rarely' THEN 'no' ELSE makadiyos END,
  CASE makatao WHEN 'always' THEN 'ao' WHEN 'often' THEN 'so' WHEN 'sometimes' THEN 'ro' WHEN 'rarely' THEN 'no' ELSE makatao END,
  CASE makakalikasan WHEN 'always' THEN 'ao' WHEN 'often' THEN 'so' WHEN 'sometimes' THEN 'ro' WHEN 'rarely' THEN 'no' ELSE makakalikasan END,
  CASE makabansa WHEN 'always' THEN 'ao' WHEN 'often' THEN 'so' WHEN 'sometimes' THEN 'ro' WHEN 'rarely' THEN 'no' ELSE makabansa END,
  remarks, created_at, updated_at
FROM student_conduct_ratings;

DROP TABLE IF EXISTS student_conduct_ratings;
ALTER TABLE student_conduct_ratings_new RENAME TO student_conduct_ratings;

CREATE INDEX IF NOT EXISTS idx_conduct_rating_student ON student_conduct_ratings (student_id, school_year, term);
