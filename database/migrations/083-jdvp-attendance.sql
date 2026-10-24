CREATE TABLE IF NOT EXISTS jdvp_attendance (
  id BIGSERIAL PRIMARY KEY,
  jdvp_recipient_id BIGINT NOT NULL REFERENCES jdvp_recipients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  time_in TIME,
  time_out TIME,
  hours NUMERIC(4,1),
  remarks TEXT,
  recorded_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (jdvp_recipient_id, date)
);

CREATE INDEX IF NOT EXISTS idx_jdvp_attendance_recipient ON jdvp_attendance(jdvp_recipient_id);
CREATE INDEX IF NOT EXISTS idx_jdvp_attendance_date ON jdvp_attendance(date);
