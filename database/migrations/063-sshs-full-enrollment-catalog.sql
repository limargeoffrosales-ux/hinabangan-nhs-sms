-- ============================================================
-- 060: Complete the SHS enrollment catalog (all SSHS electives)
-- (PostgreSQL)
--
-- Brings the catalog up to exactly the full official list that the
-- Enrollment page must offer:
--
-- * Grade 11 TechPro electives that were missing from production:
--     Automotive Servicing (Electrical Repair), Automotive Servicing
--     (Engine and Chassis Repairs), Commercial Air-Conditioning
--     Installation and Servicing, Mechatronics.
-- * The Grade 12 TechPro mirror subjects (every sector's continuation
--     subjects), plus the Grade 12 TechPro Work Immersion (320-640
--     hours) record under its own 'TechPro - Work Immersion' group.
-- * Title/category convergence so any pre-existing variants end up at
--     the same final state (grade level, category, title, units).
--
-- Idempotent: every INSERT is ON CONFLICT (code) DO NOTHING, every
-- UPDATE only touches the named rows and is safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Grade 11 TechPro electives that were absent from the catalog
-- ------------------------------------------------------------
INSERT INTO subjects (code, title, grade_level, track, units, term, category, is_offered) VALUES
('STP-AUTOEL',  'Automotive Servicing (Electrical Repair)',                'Grade 11', 'tvl', 0.5, 'all', 'tvl-automotive', TRUE),
('STP-AUTOEC',  'Automotive Servicing (Engine and Chassis Repairs)',       'Grade 11', 'tvl', 0.5, 'all', 'tvl-automotive', TRUE),
('STP-AC',      'Commercial Air-Conditioning Installation and Servicing',  'Grade 11', 'tvl', 0.5, 'all', 'tvl-industrial', TRUE),
('STP-MECHAT',  'Mechatronics',                                            'Grade 11', 'tvl', 0.5, 'all', 'tvl-industrial', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Converge existing variants (older builds left these at Grade 12):
-- the school's list offers them to Grade 11 learners.
UPDATE subjects
   SET grade_level = 'Grade 11', track = 'tvl', term = 'all', is_offered = TRUE
 WHERE code IN ('STP-AUTOEL','STP-AUTOEC','STP-AC','STP-MECHAT');

-- ------------------------------------------------------------
-- 2. Grade 12 TechPro mirrors — every sector's continuation
--    subjects + the TechPro Work Immersion (320-640 hours)
-- ------------------------------------------------------------
INSERT INTO subjects (code, title, grade_level, track, units, term, category, is_offered) VALUES
('S12T-HAIR',    'Hairdressing Services',                                  'Grade 12', 'tvl', 0.5, 'all', 'tvl-aesthetic', TRUE),
('S12T-ORGANIC', 'Organic Agriculture Production',                         'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', TRUE),
('S12T-POULTRY', 'Poultry Production (Chicken)',                           'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', TRUE),
('S12T-RUMIN',   'Ruminants Production',                                   'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', TRUE),
('S12T-SWINE',   'Swine Production',                                       'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', TRUE),
('S12T-WEAVE',   'Handicrafts (Weaving)',                                  'Grade 12', 'tvl', 0.5, 'all', 'tvl-artisanry', TRUE),
('S12T-MOTOR',   'Motorcycle and Small Engine Servicing',                  'Grade 12', 'tvl', 0.5, 'all', 'tvl-automotive', TRUE),
('S12T-SMAW',    'Manual Metal Arc Welding',                               'Grade 12', 'tvl', 0.5, 'all', 'tvl-construction', TRUE),
('S12T-ILLUS',   'Illustration',                                           'Grade 12', 'tvl', 0.5, 'all', 'tvl-creative-design', TRUE),
('S12T-VGD',     'Visual Graphic Design',                                  'Grade 12', 'tvl', 0.5, 'all', 'tvl-creative-design', TRUE),
('S12T-HOTELFO', 'Hotel Operations (Front Office Services)',               'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', TRUE),
('S12T-HOTELHS', 'Hotel Operations (Housekeeping Services)',               'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', TRUE),
('S12T-KITCH',   'Kitchen Operations',                                     'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', TRUE),
('S12T-TOURISM', 'Tourism Services',                                       'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', TRUE),
('S12T-REFRIG',  'Domestic Refrigeration and Air-Conditioning Servicing',  'Grade 12', 'tvl', 0.5, 'all', 'tvl-industrial', TRUE),
('S12T-PHOTOV',  'Photovoltaic Systems Installation',                      'Grade 12', 'tvl', 0.5, 'all', 'tvl-industrial', TRUE),
('S12T-JAVA',    'Computer Programming (Java)',                            'Grade 12', 'tvl', 0.5, 'all', 'tvl-ict', TRUE),
('S12T-ORACLE',  'Computer Programming (Oracle Database)',                 'Grade 12', 'tvl', 0.5, 'all', 'tvl-ict', TRUE),
('S12T-MARINE',  'Marine Engineering at the Support Level',                'Grade 12', 'tvl', 0.5, 'all', 'tvl-maritime', TRUE),
('S12T-MTRANSPO','Marine Transportation at the Support Level',             'Grade 12', 'tvl', 0.5, 'all', 'tvl-maritime', TRUE),
('S12T-SHIPS',   'Ships Catering Services',                                'Grade 12', 'tvl', 0.5, 'all', 'tvl-maritime', TRUE),
('S12T-WORKIMM', 'Work Immersion (Tech-Pro)',                              'Grade 12', 'tvl', 2.0, 'all', 'tvl-work-immersion', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Converge pre-existing TechPro Work Immersion rows (older builds put it
-- under 'Maritime'); it gets its own group and the official hours title.
UPDATE subjects
   SET category = 'tvl-work-immersion',
       title = 'Work Immersion (Tech-Pro)',
       units = 2.0,
       term = 'all',
       is_offered = TRUE
 WHERE code = 'S12T-WORKIMM';

-- ------------------------------------------------------------
-- 3. Title alignments to the official list
-- ------------------------------------------------------------
UPDATE subjects SET title = 'Work Immersion (Academic Track)'
 WHERE code = 'CORE-WORKIMM';

UPDATE subjects SET title = 'Introduction to the Philosophy of the Human Person'
 WHERE code = 'AAC-PHILO';