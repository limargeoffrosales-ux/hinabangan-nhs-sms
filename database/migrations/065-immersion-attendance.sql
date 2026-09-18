-- ============================================================
-- 065: Work Immersion daily attendance (PostgreSQL)
-- Daily Time Record per immersion placement
-- ============================================================

CREATE TABLE IF NOT EXISTS immersion_attendance (
  id          BIGSERIAL PRIMARY KEY,
  immersion_id BIGINT NOT NULL REFERENCES work_immersion(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'present',
  time_in     TEXT,
  time_out    TEXT,
  hours       DOUBLE PRECISION,
  remarks     TEXT,
  recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (immersion_id, date)
);
CREATE INDEX IF NOT EXISTS idx_immersion_attendance_date ON immersion_attendance (date);