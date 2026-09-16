-- ============================================================
-- 060: Complete the SHS enrollment catalog (all SSHS electives)
-- (SQLite mirror)
--
-- Brings the catalog up to exactly the full official list that the
-- Enrollment page must offer. See the PostgreSQL twin for details.
-- Idempotent: INSERT ... ON CONFLICT (code) DO NOTHING + convergence
-- UPDATEs.
-- ============================================================

INSERT INTO subjects (code, title, grade_level, track, units, term, category, is_offered) VALUES
('STP-AUTOEL',  'Automotive Servicing (Electrical Repair)',                'Grade 11', 'tvl', 0.5, 'all', 'tvl-automotive', 1),
('STP-AUTOEC',  'Automotive Servicing (Engine and Chassis Repairs)',       'Grade 11', 'tvl', 0.5, 'all', 'tvl-automotive', 1),
('STP-AC',      'Commercial Air-Conditioning Installation and Servicing',  'Grade 11', 'tvl', 0.5, 'all', 'tvl-industrial', 1),
('STP-MECHAT',  'Mechatronics',                                            'Grade 11', 'tvl', 0.5, 'all', 'tvl-industrial', 1)
ON CONFLICT (code) DO NOTHING;

UPDATE subjects
   SET grade_level = 'Grade 11', track = 'tvl', term = 'all', is_offered = 1
 WHERE code IN ('STP-AUTOEL','STP-AUTOEC','STP-AC','STP-MECHAT');

INSERT INTO subjects (code, title, grade_level, track, units, term, category, is_offered) VALUES
('S12T-HAIR',    'Hairdressing Services',                                  'Grade 12', 'tvl', 0.5, 'all', 'tvl-aesthetic', 1),
('S12T-ORGANIC', 'Organic Agriculture Production',                         'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', 1),
('S12T-POULTRY', 'Poultry Production (Chicken)',                           'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', 1),
('S12T-RUMIN',   'Ruminants Production',                                   'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', 1),
('S12T-SWINE',   'Swine Production',                                       'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', 1),
('S12T-WEAVE',   'Handicrafts (Weaving)',                                  'Grade 12', 'tvl', 0.5, 'all', 'tvl-artisanry', 1),
('S12T-MOTOR',   'Motorcycle and Small Engine Servicing',                  'Grade 12', 'tvl', 0.5, 'all', 'tvl-automotive', 1),
('S12T-SMAW',    'Manual Metal Arc Welding',                               'Grade 12', 'tvl', 0.5, 'all', 'tvl-construction', 1),
('S12T-ILLUS',   'Illustration',                                           'Grade 12', 'tvl', 0.5, 'all', 'tvl-creative-design', 1),
('S12T-VGD',     'Visual Graphic Design',                                  'Grade 12', 'tvl', 0.5, 'all', 'tvl-creative-design', 1),
('S12T-HOTELFO', 'Hotel Operations (Front Office Services)',               'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', 1),
('S12T-HOTELHS', 'Hotel Operations (Housekeeping Services)',               'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', 1),
('S12T-KITCH',   'Kitchen Operations',                                     'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', 1),
('S12T-TOURISM', 'Tourism Services',                                       'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', 1),
('S12T-REFRIG',  'Domestic Refrigeration and Air-Conditioning Servicing',  'Grade 12', 'tvl', 0.5, 'all', 'tvl-industrial', 1),
('S12T-PHOTOV',  'Photovoltaic Systems Installation',                      'Grade 12', 'tvl', 0.5, 'all', 'tvl-industrial', 1),
('S12T-JAVA',    'Computer Programming (Java)',                            'Grade 12', 'tvl', 0.5, 'all', 'tvl-ict', 1),
('S12T-ORACLE',  'Computer Programming (Oracle Database)',                 'Grade 12', 'tvl', 0.5, 'all', 'tvl-ict', 1),
('S12T-MARINE',  'Marine Engineering at the Support Level',                'Grade 12', 'tvl', 0.5, 'all', 'tvl-maritime', 1),
('S12T-MTRANSPO','Marine Transportation at the Support Level',             'Grade 12', 'tvl', 0.5, 'all', 'tvl-maritime', 1),
('S12T-SHIPS',   'Ships Catering Services',                                'Grade 12', 'tvl', 0.5, 'all', 'tvl-maritime', 1),
('S12T-WORKIMM', 'Work Immersion (Tech-Pro)',                              'Grade 12', 'tvl', 2.0, 'all', 'tvl-work-immersion', 1)
ON CONFLICT (code) DO NOTHING;

UPDATE subjects
   SET category = 'tvl-work-immersion',
       title = 'Work Immersion (Tech-Pro)',
       units = 2.0,
       term = 'all',
       is_offered = 1
 WHERE code = 'S12T-WORKIMM';

UPDATE subjects SET title = 'Work Immersion (Academic Track)'
 WHERE code = 'CORE-WORKIMM';

UPDATE subjects SET title = 'Introduction to the Philosophy of the Human Person'
 WHERE code = 'AAC-PHILO';