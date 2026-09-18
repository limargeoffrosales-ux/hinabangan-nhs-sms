-- Migration 064 (SQLite): Placement locations for Work Immersion + JDVP
ALTER TABLE work_immersion ADD COLUMN address TEXT;
ALTER TABLE work_immersion ADD COLUMN lat REAL;
ALTER TABLE work_immersion ADD COLUMN lng REAL;

ALTER TABLE jdvp_recipients ADD COLUMN address TEXT;
ALTER TABLE jdvp_recipients ADD COLUMN lat REAL;
ALTER TABLE jdvp_recipients ADD COLUMN lng REAL;