-- 017-teacher-user-link.sqlite.sql
-- Links teacher records to login accounts so that advisers and subject
-- teachers can be scoped to the students and classes they handle.

ALTER TABLE teachers ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_teachers_user ON teachers (user_id);
