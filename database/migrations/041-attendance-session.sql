-- 041: Add session (AM/PM) to attendance for SF2 DepEd compliance

-- Step 1: Drop the old UNIQUE constraint that prevents AM+PM per day
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_key;

-- Step 2: Add session column (AM, PM, or NULL for legacy single-session rows)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS session TEXT DEFAULT NULL;

-- Step 3: Re-create the UNIQUE constraint to allow AM + PM per student per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_student_date_session
  ON attendance (student_id, date, session);
