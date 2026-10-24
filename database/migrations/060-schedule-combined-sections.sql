-- ============================================================
-- 060: Combined-class scheduling (two sections, one meeting)
-- (PostgreSQL)
--
-- A combined class pairs two sections for a shared subject
-- (scarce teachers / small enrolments): the generator schedules
-- ONE meeting that covers both. The primary section lives in
-- section_id; the companion lives in combined_section_id.
-- ============================================================

ALTER TABLE class_assignments
  ADD COLUMN IF NOT EXISTS combined_section_id BIGINT REFERENCES sections(id) ON DELETE SET NULL;

ALTER TABLE schedule_entries
  ADD COLUMN IF NOT EXISTS combined_section_id BIGINT REFERENCES sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_combined
  ON schedule_entries (combined_section_id);