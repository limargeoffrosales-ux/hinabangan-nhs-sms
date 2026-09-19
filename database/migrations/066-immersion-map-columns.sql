-- ============================================================
-- 066: Immersion Map Columns
-- Add lat/lng to work_immersion for Leaflet map pins
-- ============================================================

-- PostgreSQL: Add lat/lng with IF NOT EXISTS syntax
-- (064 already adds these; kept as idempotent guards.)
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE work_immersion ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;