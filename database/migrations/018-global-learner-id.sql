-- 018-global-learner-id.sql
-- Adds an ISN-style global learner identifier alongside the PH LRN so records
-- can be exchanged with international SIS platforms (OneRoster identifier).
-- Backfills existing students so every record has a stable global id.

ALTER TABLE students ADD COLUMN IF NOT EXISTS global_learner_id TEXT;

UPDATE students
SET global_learner_id = 'HNHS-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || LPAD(id::text, 6, '0')
WHERE global_learner_id IS NULL OR global_learner_id = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_global_learner_id ON students (global_learner_id);
