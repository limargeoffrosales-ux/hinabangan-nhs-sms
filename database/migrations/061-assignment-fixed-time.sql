-- ============================================================
-- 061: Manual time pinning for subject assignments
-- (PostgreSQL)
--
-- Lets an admin pin ONE meeting of an assignment to a fixed
-- day/time so overloaded teachers can be placed by hand. The
-- generator honours the pin on regeneration; remaining meetings
-- are still auto-placed.
-- ============================================================

ALTER TABLE class_assignments
  ADD COLUMN IF NOT EXISTS fixed_day INTEGER;             -- 1 (Mon) .. 5 (Fri)

ALTER TABLE class_assignments
  ADD COLUMN IF NOT EXISTS fixed_start_time TEXT;         -- 'HH:MM'