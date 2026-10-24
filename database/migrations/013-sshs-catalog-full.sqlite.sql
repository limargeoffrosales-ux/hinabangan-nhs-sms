-- ============================================================
-- 013: Full Strengthened SHS curriculum catalog (official list)
-- (SQLite mirror)
-- ============================================================

ALTER TABLE subjects ADD COLUMN category TEXT;

-- 1. Categories for the existing catalog
UPDATE subjects SET category = 'core'
 WHERE code IN ('SSHS-COMM','SSHS-FILKOM','SSHS-GENMATH','SSHS-GENSCI','SSHS-LIFESKILLS','SSHS-PHILHIST');

UPDATE subjects SET category = 'arts-humanities'
 WHERE code IN ('AAC-CONTLIT1','AAC-CONTLIT2','AAC-CRECOMP1','AAC-CRECOMP2','AAC-CITZ','AAC-PHILO',
                'AAC-FILIP1','AAC-FILIP2P','AAC-FILIP2I','AAC-FILIP2S','AAC-SOCSCI','AAC-FILIDENT',
                'AAC-ARTCRIT','AAC-PERFCRIT','AAC-POLGOV','AAC-CIARTS','AAC-CIDANCE','AAC-CILIT',
                'AAC-CIMEDIA','AAC-CIMUSIC','AAC-CITHEAT','AAC-CIVISUAL','AAC-ARTSMGT');
UPDATE subjects SET category = 'business-entrepreneurship'
 WHERE code IN ('AAC-BUS1','AAC-BUS2','AAC-BUS3','AAC-MARKET','AAC-ENTREP','AAC-ORGMGT');
UPDATE subjects SET category = 'stem'
 WHERE code IN ('AAC-BIO1','AAC-BIO2','AAC-CHEM1','AAC-CHEM2','AAC-EARTH1','AAC-EARTH2',
                'AAC-FINMATH1','AAC-FINMATH2','AAC-PHYS1','AAC-PHYS2');
UPDATE subjects SET category = 'sports-health-wellness'
 WHERE code IN ('AAC-PE1','AAC-PE2','AAC-HUMMOV1','AAC-HUMMOV2','AAC-SAM','AAC-COACH','AAC-OFFIC');

UPDATE subjects SET category = 'stem'
 WHERE code IN ('S12-ADVMATH','S12-BCALC','S12-BIO3','S12-BIO4','S12-CHEM3','S12-CHEM4','S12-CONBIO',
                'S12-CONPHY','S12-DBM','S12-ESS3','S12-ESS4','S12-EMPOWTECH','S12-DATAAN',
                'S12-PHYS3','S12-PHYS4','S12-PRECALC');
UPDATE subjects SET category = 'arts-humanities' WHERE code = 'S12-CREATPROD';
UPDATE subjects SET category = 'sports-health-wellness'
 WHERE code IN ('S12-EXERSP','S12-FIRSTAID','S12-BLS');
UPDATE subjects SET category = 'field-experience'
 WHERE code IN ('S12-RESEARCH1','S12-RESEARCH2','S12-DESIGN','S12-FIELDSPORT',
                'S12-APPRDANCE','S12-APPLIT','S12-APPMEDIA','S12-APPMUSIC','S12-APPTHEAT',
                'S12-APPTRAD','S12-APPVISUAL','CORE-WORKIMM');

UPDATE subjects SET category = 'tvl-aesthetic'
 WHERE code IN ('STP-BEAUTY','STP-CAREAD','STP-CARECH','STP-HAIR');
UPDATE subjects SET category = 'tvl-agri-fishery'
 WHERE code IN ('STP-AGRI','STP-AGRO','STP-AQUA','STP-FISHC','STP-FOODP','STP-ORGANIC',
                'STP-POULTRY','STP-RUMIN','STP-SWINE');
UPDATE subjects SET category = 'tvl-artisanry' WHERE code IN ('STP-GARMENT','STP-WEAVE');
UPDATE subjects SET category = 'tvl-automotive'
 WHERE code IN ('STP-AUTOEL','STP-AUTOEC','STP-DRIVING','STP-MOTOR');
UPDATE subjects SET category = 'tvl-construction'
 WHERE code IN ('STP-CARP','STP-CONSTR','STP-SMAW','STP-DRAFT');
UPDATE subjects SET category = 'tvl-creative-design' WHERE code IN ('STP-ANIM','STP-ILLUS','STP-VGD');
UPDATE subjects SET category = 'tvl-hospitality'
 WHERE code IN ('STP-BAKERY','STP-EVENTS','STP-FBS','STP-HOTELFO','STP-HOTELHS','STP-KITCH','STP-TOURISM');
UPDATE subjects SET category = 'tvl-industrial'
 WHERE code IN ('STP-AC','STP-REFRIG','STP-EIM','STP-EPAS','STP-MECHAT','STP-PHOTOV');
UPDATE subjects SET category = 'tvl-ict'
 WHERE code IN ('STP-BROADBAND','STP-JAVA','STP-DOTNET','STP-ORACLE','STP-CSS','STP-CONTACT');
UPDATE subjects SET category = 'tvl-maritime' WHERE code IN ('STP-MARINE','STP-MTRANSPO','STP-SHIPS');

-- 2. Hide legacy pre-SSHS continuity subjects and superseded codes
UPDATE subjects SET is_offered = 0
 WHERE code IN ('CORE-MIL','CORE-PR2','CORE-ENTREP','HUMSS-TRENDS','HUMSS-DISS','HUMSS-PPG',
                'HUMSS-DIASS','HUMSS-CESC','HUMSS-CRWRTG','STEM-PHYSCI','STEM-GENCHEM2',
                'STEM-GENPHYS2','STEM-GENBIO2','STEM-CAPSTONE','ABM-APPECON','ABM-BUSETH',
                'ABM-FABM2','ABM-BUSFIN','TVL-EMPOWER','STP-PROG','STP-COOK','STP-BPP',
                'STP-ANIPROD','STP-AUTO','STP-DRESS','AAC-ARTS1','AAC-ARTS2');

-- 3. Grade-level corrections per the official list
UPDATE subjects SET grade_level = 'Grade 12'
 WHERE code IN ('AAC-ARTCRIT','AAC-PERFCRIT','AAC-FILIP2P','AAC-FILIP2I','AAC-FILIP2S',
                'AAC-ENTREP','AAC-COACH','STP-AUTOEL','STP-AUTOEC','STP-AC','STP-MECHAT');

-- Titles aligned to the official list
UPDATE subjects SET title = 'Aesthetic Services (Beauty Care)' WHERE code = 'STP-BEAUTY';
UPDATE subjects SET title = 'Manual Metal Arc Welding' WHERE code = 'STP-SMAW';
UPDATE subjects SET title = 'Food and Beverage Operation' WHERE code = 'STP-FBS';
UPDATE subjects SET title = 'Tourism Services' WHERE code = 'STP-TOURISM';
UPDATE subjects SET title = 'Field Exposure (In Campus)' WHERE code = 'S12-FIELDSPORT';

-- Units for 160h/320h field-experience subjects
UPDATE subjects SET units = 1.0
 WHERE code IN ('S12-CREATPROD','S12-FIELDSPORT','S12-APPRDANCE','S12-APPLIT','S12-APPMEDIA',
                'S12-APPMUSIC','S12-APPTHEAT','S12-APPTRAD','S12-APPVISUAL');
UPDATE subjects SET units = 2.0 WHERE code IN ('CORE-WORKIMM');

-- 4. All SHS subjects are offered in every term
UPDATE subjects SET term = 'all' WHERE grade_level IN ('Grade 11', 'Grade 12');

-- 5. Missing official subjects (Grade 11 additions + Grade 12 pairs)
INSERT INTO subjects (code, title, grade_level, track, units, term, category, is_offered) VALUES
('AAC-MALIKHA',  'Malikhaing Pagsulat',                                 'Grade 11', 'academic', 0.5, 'all', 'arts-humanities', 1),
('AAC-EMPOWTECH','Empowerment Technologies',                            'Grade 11', 'academic', 0.5, 'all', 'stem', 1),
('AAC-PRECALC',  'Pre-Calculus',                                        'Grade 11', 'academic', 0.5, 'all', 'stem', 1),
('AAC-RESEARCH1','Research 1',                                          'Grade 11', 'academic', 0.5, 'all', 'field-experience', 1),
('AAC-RESEARCH2','Research 2',                                          'Grade 11', 'academic', 0.5, 'all', 'field-experience', 1),
('S12-CONTLIT1', 'Contemporary Literature 1',                           'Grade 12', 'academic', 0.5, 'all', 'arts-humanities', 1),
('S12-CONTLIT2', 'Contemporary Literature 2',                           'Grade 12', 'academic', 0.5, 'all', 'arts-humanities', 1),
('S12-CRECOMP1', 'Creative Composition 1',                              'Grade 12', 'academic', 0.5, 'all', 'arts-humanities', 1),
('S12-CRECOMP2', 'Creative Composition 2',                              'Grade 12', 'academic', 0.5, 'all', 'arts-humanities', 1),
('S12-CITZ',     'Citizenship and Civic Engagement',                    'Grade 12', 'academic', 0.5, 'all', 'arts-humanities', 1),
('S12-PHILO',    'Introduction to the Philosophy of the Human Person',  'Grade 12', 'academic', 0.5, 'all', 'arts-humanities', 1),
('S12-FILIP1',   'Filipino 1 (Wika at Komunikasyon sa Akademikong Filipino)', 'Grade 12', 'academic', 0.5, 'all', 'arts-humanities', 1),
('S12-MALIKS',   'Malikhaing Pagsulat',                                 'Grade 12', 'academic', 0.5, 'all', 'arts-humanities', 1),
('S12-POLGOV',   'Philippine Governance (Philippine Politics and Governance)', 'Grade 12', 'academic', 0.5, 'all', 'arts-humanities', 1),
('S12-SOCSCI',   'Social Sciences (Theory and Practice)',               'Grade 12', 'academic', 0.5, 'all', 'arts-humanities', 1),
('S12-BUS2',     'Business 2 (Business Finance and Income Taxation)',   'Grade 12', 'academic', 0.5, 'all', 'business-entrepreneurship', 1),
('S12-BUS3',     'Business 3 (Business Economics)',                      'Grade 12', 'academic', 0.5, 'all', 'business-entrepreneurship', 1),
('S12-MARKET',   'Contemporary Marketing',                              'Grade 12', 'academic', 0.5, 'all', 'business-entrepreneurship', 1),
('S12-BIO2',     'Biology 2',                                           'Grade 12', 'academic', 0.5, 'all', 'stem', 1),
('S12-CHEM2',    'Chemistry 2',                                         'Grade 12', 'academic', 0.5, 'all', 'stem', 1),
('S12-ESS2',     'Earth and Space Science 2',                           'Grade 12', 'academic', 0.5, 'all', 'stem', 1),
('S12-FINMATH1', 'Finite Mathematics 1',                                'Grade 12', 'academic', 0.5, 'all', 'stem', 1),
('S12-FINMATH2', 'Finite Mathematics 2',                                'Grade 12', 'academic', 0.5, 'all', 'stem', 1),
('S12-PHYS2',    'Physics 2',                                           'Grade 12', 'academic', 0.5, 'all', 'stem', 1),
('S12-PE1',      'Physical Education 1 (Fitness and Recreation)',       'Grade 12', 'academic', 0.5, 'all', 'sports-health-wellness', 1),
('S12-PE2',      'Physical Education 2 (Sports and Dance)',             'Grade 12', 'academic', 0.5, 'all', 'sports-health-wellness', 1),
('S12-SAM',      'Sports Activity Management',                          'Grade 12', 'academic', 0.5, 'all', 'sports-health-wellness', 1),
('S12-FIELDOFF', 'Field Exposure (Off Campus)',                         'Grade 12', 'academic', 0.5, 'all', 'field-experience', 1)
ON CONFLICT (code) DO NOTHING;

-- 6. TechPro electives — Grade 12 mirror of every sector
INSERT INTO subjects (code, title, grade_level, track, units, term, category, is_offered) VALUES
('S12T-BEAUTY',  'Aesthetic Services (Beauty Care)',                       'Grade 12', 'tvl', 0.5, 'all', 'tvl-aesthetic', 1),
('S12T-CAREAD',  'Caregiving (Adult Care)',                                'Grade 12', 'tvl', 0.5, 'all', 'tvl-aesthetic', 1),
('S12T-CARECH',  'Caregiving (Child Care)',                                'Grade 12', 'tvl', 0.5, 'all', 'tvl-aesthetic', 1),
('S12T-HAIR',    'Hairdressing Services',                                  'Grade 12', 'tvl', 0.5, 'all', 'tvl-aesthetic', 1),
('S12T-AGRI',    'Agricultural Crops Production',                          'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', 1),
('S12T-AGRO',    'Agro-Entrepreneurship',                                  'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', 1),
('S12T-AQUA',    'Aquaculture',                                            'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', 1),
('S12T-FISHC',   'Fish Capture Operation',                                 'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', 1),
('S12T-FOODP',   'Food Processing',                                        'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', 1),
('S12T-ORGANIC', 'Organic Agriculture Production',                         'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', 1),
('S12T-POULTRY', 'Poultry Production (Chicken)',                           'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', 1),
('S12T-RUMIN',   'Ruminants Production',                                   'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', 1),
('S12T-SWINE',   'Swine Production',                                       'Grade 12', 'tvl', 0.5, 'all', 'tvl-agri-fishery', 1),
('S12T-GARMENT', 'Garments Artisanry',                                     'Grade 12', 'tvl', 0.5, 'all', 'tvl-artisanry', 1),
('S12T-WEAVE',   'Handicrafts (Weaving)',                                  'Grade 12', 'tvl', 0.5, 'all', 'tvl-artisanry', 1),
('S12T-DRIVING', 'Driving and Automotive Servicing',                       'Grade 12', 'tvl', 0.5, 'all', 'tvl-automotive', 1),
('S12T-MOTOR',   'Motorcycle and Small Engine Servicing',                  'Grade 12', 'tvl', 0.5, 'all', 'tvl-automotive', 1),
('S12T-CARP',    'Carpentry',                                              'Grade 12', 'tvl', 0.5, 'all', 'tvl-construction', 1),
('S12T-CONSTR',  'Construction Operation',                                 'Grade 12', 'tvl', 0.5, 'all', 'tvl-construction', 1),
('S12T-SMAW',    'Manual Metal Arc Welding',                               'Grade 12', 'tvl', 0.5, 'all', 'tvl-construction', 1),
('S12T-DRAFT',   'Technical Drafting',                                     'Grade 12', 'tvl', 0.5, 'all', 'tvl-construction', 1),
('S12T-ANIM',    'Animation',                                              'Grade 12', 'tvl', 0.5, 'all', 'tvl-creative-design', 1),
('S12T-ILLUS',   'Illustration',                                           'Grade 12', 'tvl', 0.5, 'all', 'tvl-creative-design', 1),
('S12T-VGD',     'Visual Graphic Design',                                  'Grade 12', 'tvl', 0.5, 'all', 'tvl-creative-design', 1),
('S12T-BAKERY',  'Bakery Operations',                                      'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', 1),
('S12T-EVENTS',  'Events Management Services',                             'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', 1),
('S12T-FBS',     'Food and Beverage Operation',                            'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', 1),
('S12T-HOTELFO', 'Hotel Operations (Front Office Services)',               'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', 1),
('S12T-HOTELHS', 'Hotel Operations (Housekeeping Services)',               'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', 1),
('S12T-KITCH',   'Kitchen Operations',                                     'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', 1),
('S12T-TOURISM', 'Tourism Services',                                       'Grade 12', 'tvl', 0.5, 'all', 'tvl-hospitality', 1),
('S12T-REFRIG',  'Domestic Refrigeration and Air-Conditioning Servicing',  'Grade 12', 'tvl', 0.5, 'all', 'tvl-industrial', 1),
('S12T-EIM',     'Electrical Installation and Maintenance',                'Grade 12', 'tvl', 0.5, 'all', 'tvl-industrial', 1),
('S12T-EPAS',    'Electronic Products Assembly and Servicing',             'Grade 12', 'tvl', 0.5, 'all', 'tvl-industrial', 1),
('S12T-PHOTOV',  'Photovoltaic Systems Installation',                      'Grade 12', 'tvl', 0.5, 'all', 'tvl-industrial', 1),
('S12T-BROADBAND','Broadband Installation',                                'Grade 12', 'tvl', 0.5, 'all', 'tvl-ict', 1),
('S12T-JAVA',    'Computer Programming (Java)',                            'Grade 12', 'tvl', 0.5, 'all', 'tvl-ict', 1),
('S12T-DOTNET',  'Computer Programming (.NET Technology)',                 'Grade 12', 'tvl', 0.5, 'all', 'tvl-ict', 1),
('S12T-ORACLE',  'Computer Programming (Oracle Database)',                 'Grade 12', 'tvl', 0.5, 'all', 'tvl-ict', 1),
('S12T-CSS',     'Computer Systems Servicing',                             'Grade 12', 'tvl', 0.5, 'all', 'tvl-ict', 1),
('S12T-CONTACT', 'Contact Center Services',                                'Grade 12', 'tvl', 0.5, 'all', 'tvl-ict', 1),
('S12T-MARINE',  'Marine Engineering at the Support Level',                'Grade 12', 'tvl', 0.5, 'all', 'tvl-maritime', 1),
('S12T-MTRANSPO','Marine Transportation at the Support Level',             'Grade 12', 'tvl', 0.5, 'all', 'tvl-maritime', 1),
('S12T-SHIPS',   'Ships Catering Services',                                'Grade 12', 'tvl', 0.5, 'all', 'tvl-maritime', 1),
('S12T-WORKIMM', 'Work Immersion (TechPro)',                               'Grade 12', 'tvl', 2.0, 'all', 'tvl-maritime', 1)
ON CONFLICT (code) DO NOTHING;

-- 7. Enable the full official TechPro catalog (school can toggle per-subject)
--    Legacy superseded TVL codes (no category) stay hidden.
UPDATE subjects SET is_offered = 1 WHERE track = 'tvl' AND category IS NOT NULL;
