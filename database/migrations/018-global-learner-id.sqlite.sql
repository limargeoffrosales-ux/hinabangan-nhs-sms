-- 018-global-learner-id.sqlite.sql
-- SQLite variant: ISN-style global learner identifier alongside the PH LRN.

ALTER TABLE students ADD COLUMN global_learner_id TEXT;

UPDATE students
SET global_learner_id = 'HNHS-' || strftime('%Y', 'now') || '-' || printf('%06d', id)
WHERE global_learner_id IS NULL OR global_learner_id = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_global_learner_id ON students (global_learner_id);
