-- 021-portals.sqlite.sql
-- SQLite variant: student portal login link + parent-student link.

ALTER TABLE students ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_user ON students (user_id);

CREATE TABLE IF NOT EXISTS parent_students (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relation       TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (parent_user_id, student_id)
);
