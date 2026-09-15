-- ============================================================
-- 061: Manual time pinning for subject assignments
-- (SQLite)
--
-- Lets an admin pin ONE meeting of an assignment to a fixed
-- day/time so overloaded teachers can be placed by hand.
-- ============================================================

ALTER TABLE class_assignments
  ADD COLUMN fixed_day INTEGER;             -- 1 (Mon) .. 5 (Fri)

ALTER TABLE class_assignments
  ADD COLUMN fixed_start_time TEXT;         -- 'HH:MM'