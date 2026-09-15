-- ============================================================
-- 060: Combined-class scheduling (two sections, one meeting)
-- (SQLite)
--
-- Adds a companion section id to class_assignments and
-- schedule_entries so one meeting can serve two sections.
-- ============================================================

ALTER TABLE class_assignments
  ADD COLUMN combined_section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL;

ALTER TABLE schedule_entries
  ADD COLUMN combined_section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_combined
  ON schedule_entries (combined_section_id);