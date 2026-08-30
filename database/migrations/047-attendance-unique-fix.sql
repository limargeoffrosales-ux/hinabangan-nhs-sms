-- Fix: NULL sessions bypass UNIQUE(student_id, date, session)
-- Add a coalesced unique index that treats NULL as 'default'
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_nocoalesce
  ON attendance (student_id, date, COALESCE(session, 'default'));
-- Drop the old incomplete unique constraint if it exists
-- (the original UNIQUE index from 041 may still be present)
