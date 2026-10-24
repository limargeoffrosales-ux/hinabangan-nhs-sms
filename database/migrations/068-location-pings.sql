-- ============================================================
-- 068: Location Pings for Live Tracking
-- Stores student location pings during work immersion hours
-- ============================================================
-- Note: lat/lng columns already exist on work_immersion from migration 066
-- This migration only creates the location_pings table
-- ============================================================
CREATE TABLE IF NOT EXISTS location_pings (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  venue_id BIGINT REFERENCES work_immersion_venues(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  pinged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_location_pings_student ON location_pings (student_id);
CREATE INDEX IF NOT EXISTS idx_location_pings_active ON location_pings (is_active) WHERE is_active = TRUE;