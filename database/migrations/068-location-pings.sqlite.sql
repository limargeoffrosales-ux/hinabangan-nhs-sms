-- ============================================================
-- 068 (SQLite): Location Pings for Live Tracking
-- Stores student location pings during work immersion hours
-- Note: lat/lng columns already exist on work_immersion from migration 066
-- This migration only creates the location_pings table
-- ============================================================
CREATE TABLE IF NOT EXISTS location_pings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  venue_id INTEGER REFERENCES work_immersion_venues(id) ON DELETE SET NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  pinged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_location_pings_student ON location_pings (student_id);
CREATE INDEX IF NOT EXISTS idx_location_pings_active ON location_pings (is_active);