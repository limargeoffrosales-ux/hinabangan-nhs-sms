-- ============================================================
-- 007: Enrollment subject checklist + Aral program flag
-- (PostgreSQL)
-- ============================================================

-- 1. Link each term enrollment to the subjects the student took
--    (cores + chosen academic/tvl electives via checklist)
CREATE TABLE IF NOT EXISTS enrollment_subjects (
  id            BIGSERIAL PRIMARY KEY,
  enrollment_id BIGINT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  subject_id    BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollment_subjects_subject
  ON enrollment_subjects (subject_id);

-- 2. Aral program participation flag on the enrollment record
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS is_aral BOOLEAN NOT NULL DEFAULT FALSE;
