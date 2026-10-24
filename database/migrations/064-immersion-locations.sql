-- Migration 064: Placement locations for Work Immersion + JDVP
-- Adds address, latitude and longitude so learner placements can be traced on a map.
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

ALTER TABLE jdvp_recipients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE jdvp_recipients ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE jdvp_recipients ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;