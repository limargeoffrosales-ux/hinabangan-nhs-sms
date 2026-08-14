-- 021-portals.sql
-- Postgres variant: student portal login link + parent-student link.

ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_user ON students (user_id);

CREATE TABLE IF NOT EXISTS parent_students (
  id             BIGSERIAL PRIMARY KEY,
  parent_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id     BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relation       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_user_id, student_id)
);
