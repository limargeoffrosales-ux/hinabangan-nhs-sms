CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_nocoalesce
  ON attendance (student_id, date, COALESCE(session, 'default'));
