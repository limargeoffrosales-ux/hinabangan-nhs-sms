-- ============================================================
-- 066: Immersion Map Columns
-- Add lat/lng to work_immersion for Leaflet map pins
-- ============================================================

-- PostgreSQL: Add lat/lng with IF NOT EXISTS syntax
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- SQLite: Add lat/lng columns
ALTER TABLE work_immersion ADD COLUMN lat REAL;
ALTER TABLE work_immersion ADD COLUMN lng REAL;
ALTER TABLE work_immersion ADD COLUMN address TEXT;