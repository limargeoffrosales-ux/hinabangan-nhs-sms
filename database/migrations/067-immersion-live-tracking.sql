-- ============================================================
-- 067: Work Immersion live-location tracking
-- Optional opt-in GPS check-ins from students' phones during
-- immersion hours. Staff see the latest check-in per student.
-- ============================================================

-- A student may have several placements; each placement gets its
-- own consent via work_immersion.consent_status ('pending'/'granted'/
-- 'denied'). This table stores the stream of check-ins.
CREATE TABLE IF NOT EXISTS work_immersion_tracking (
  id          BIGSERIAL PRIMARY KEY,
  student_id  BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  immersion_id BIGINT NOT NULL REFERENCES work_immersion(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  accuracy_m  INTEGER,
  source      TEXT NOT NULL DEFAULT 'device', -- device, manual, map
  reported_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Latest check-in per student is the hot lookup for the live map.
CREATE INDEX IF NOT EXISTS idx_wit_student_time ON work_immersion_tracking (student_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_wit_immersion_time ON work_immersion_tracking (immersion_id, captured_at DESC);