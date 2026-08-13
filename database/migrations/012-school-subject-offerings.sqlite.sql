-- ============================================================
-- 012: School subject offerings (SQLite mirror)
-- The school offers ONLY the following TechPro (TVL) electives:
--   STP-GARMENT  Garments Artisanry
--   STP-CSS      Computer Systems Servicing
--   STP-EIM      Electrical Installation and Maintenance
-- All other TVL-track subjects are marked as not offered so they
-- are hidden from enrollment, dashboards, etc.
-- ============================================================

ALTER TABLE subjects ADD COLUMN is_offered INTEGER NOT NULL DEFAULT 1;

UPDATE subjects SET is_offered = 0
 WHERE track = 'tvl'
   AND code NOT IN ('STP-GARMENT', 'STP-CSS', 'STP-EIM');
