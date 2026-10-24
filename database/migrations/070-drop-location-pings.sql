-- ============================================================
-- 070: Drop unused location_pings table
-- Added in 068 but superseded by work_immersion_tracking, which
-- anchors check-ins to an immersive placement (with consent). The
-- portal already reports location via /immersion/tracking/location.
-- ============================================================

DROP TABLE IF EXISTS location_pings;