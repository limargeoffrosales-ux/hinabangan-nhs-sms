-- ============================================================
-- 006: Full Strengthened SHS curriculum catalog, term-based
-- enrollment, teacher rooms, and custom AI document formats
-- (SQLite mirror)
-- ============================================================

-- 1. Schema additions ----------------------------------------
ALTER TABLE teachers ADD COLUMN room TEXT;

CREATE TABLE IF NOT EXISTS enrollments_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id  INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  school_year TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  strand      TEXT,
  term        TEXT,
  status      TEXT NOT NULL DEFAULT 'enrolled',
  enrolled_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, school_year, term)
);
INSERT INTO enrollments_new (id, student_id, section_id, school_year, grade_level, strand, status, enrolled_at, created_at)
  SELECT id, student_id, section_id, school_year, grade_level, strand, status, enrolled_at, created_at FROM enrollments;
DROP TABLE enrollments;
ALTER TABLE enrollments_new RENAME TO enrollments;
CREATE INDEX IF NOT EXISTS idx_enrollments_sec  ON enrollments (section_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_term ON enrollments (school_year, term);

CREATE TABLE IF NOT EXISTS doc_formats (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  body       TEXT NOT NULL,
  fields     TEXT NOT NULL DEFAULT '[]',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Grade 11 — Core subjects (whole year) -------------------
INSERT OR IGNORE INTO subjects (code, title, grade_level, track, units, term) VALUES
('SSHS-COMM',      'Effective Communication',                       'Grade 11', 'academic', 1.0, 'all'),
('SSHS-FILKOM',    'Mabisang Komunikasyon',                         'Grade 11', 'academic', 1.0, 'all'),
('SSHS-GENMATH',   'General Mathematics',                           'Grade 11', 'academic', 1.0, 'all'),
('SSHS-GENSCI',    'General Science',                               'Grade 11', 'academic', 1.0, 'all'),
('SSHS-LIFESKILLS','Life and Career Skills',                        'Grade 11', 'academic', 1.0, 'all'),
('SSHS-PHILHIST',  'Pag-aaral ng Kasaysayan at Lipunang Pilipino',  'Grade 11', 'academic', 1.0, 'all');

-- 3. Grade 11 — Academic electives (0.5 unit per term) --------
INSERT OR IGNORE INTO subjects (code, title, grade_level, track, units, term) VALUES
('AAC-CONTLIT1', 'Contemporary Literature 1',                                      'Grade 11', 'academic', 0.5, 'first'),
('AAC-CONTLIT2', 'Contemporary Literature 2',                                      'Grade 11', 'academic', 0.5, 'second'),
('AAC-CRECOMP1', 'Creative Composition 1 / Malikhaing Pagsulat',                   'Grade 11', 'academic', 0.5, 'first'),
('AAC-CRECOMP2', 'Creative Composition 2',                                         'Grade 11', 'academic', 0.5, 'third'),
('AAC-CITZ',     'Citizenship and Civic Engagement',                               'Grade 11', 'academic', 0.5, 'second'),
('AAC-PHILO',    'Introduction to Philosophy',                                     'Grade 11', 'academic', 0.5, 'third'),
('AAC-FILIP1',   'Filipino 1 - Wika at Komunikasyon sa Akademikong Filipino',      'Grade 11', 'academic', 0.5, 'first'),
('AAC-FILIP2P',  'Filipino 2 - Filipino para sa Larang Teknikal Propesyonal',      'Grade 11', 'academic', 0.5, 'second'),
('AAC-FILIP2I',  'Filipino 2 - Filipino sa Isports',                                'Grade 11', 'academic', 0.5, 'third'),
('AAC-FILIP2S',  'Filipino 2 - Filipino sa Sining at Disenyo',                      'Grade 11', 'academic', 0.5, 'third'),
('AAC-SOCSCI',   'Social Sciences Theory and Practice',                            'Grade 11', 'academic', 0.5, 'second'),
('AAC-FILIDENT', 'Filipino Identity Through the Arts',                             'Grade 11', 'academic', 0.5, 'first'),
('AAC-ARTCRIT',  'Art Criticism and Creative Markets',                             'Grade 11', 'academic', 0.5, 'second'),
('AAC-PERFCRIT', 'Performance Criticism and Creative Markets',                     'Grade 11', 'academic', 0.5, 'third'),
('AAC-POLGOV',   'Philippine Governance / Philippine Politics and Governance',     'Grade 11', 'academic', 0.5, 'first'),
('AAC-ARTS1',    'Arts 1 (Creative Industries 1)',                                 'Grade 11', 'academic', 0.5, 'second'),
('AAC-ARTS2',    'Arts 2 (Creative Industries: Music, Dance and Theater)',         'Grade 11', 'academic', 0.5, 'third'),
('AAC-CIARTS',   'Creative Industries - Applied and Traditional Arts',             'Grade 11', 'academic', 0.5, 'first'),
('AAC-CIDANCE',  'Creative Industries - Dance',                                    'Grade 11', 'academic', 0.5, 'second'),
('AAC-CILIT',    'Creative Industries - Literary Arts',                            'Grade 11', 'academic', 0.5, 'third'),
('AAC-CIMEDIA',  'Creative Industries - Media Arts',                               'Grade 11', 'academic', 0.5, 'first'),
('AAC-CIMUSIC',  'Creative Industries - Music',                                    'Grade 11', 'academic', 0.5, 'second'),
('AAC-CITHEAT',  'Creative Industries - Theater Arts',                             'Grade 11', 'academic', 0.5, 'third'),
('AAC-CIVISUAL', 'Creative Industries - Visual Arts',                              'Grade 11', 'academic', 0.5, 'first'),
('AAC-ARTSMGT',  'Leadership and Management in the Arts',                          'Grade 11', 'academic', 0.5, 'second'),
('AAC-BUS1',     'Business 1 (Basic Accounting)',                                  'Grade 11', 'academic', 0.5, 'first'),
('AAC-BUS2',     'Business 2 (Business Finance and Income Taxation)',              'Grade 11', 'academic', 0.5, 'second'),
('AAC-BUS3',     'Business 3 (Business Economics)',                                'Grade 11', 'academic', 0.5, 'third'),
('AAC-MARKET',   'Contemporary Marketing',                                         'Grade 11', 'academic', 0.5, 'second'),
('AAC-ENTREP',   'Entrepreneurship',                                               'Grade 11', 'academic', 0.5, 'third'),
('AAC-ORGMGT',   'Introduction to Organization and Management',                    'Grade 11', 'academic', 0.5, 'first'),
('AAC-BIO1',     'Biology 1',                                                      'Grade 11', 'academic', 0.5, 'first'),
('AAC-BIO2',     'Biology 2',                                                      'Grade 11', 'academic', 0.5, 'second'),
('AAC-CHEM1',    'Chemistry 1',                                                    'Grade 11', 'academic', 0.5, 'second'),
('AAC-CHEM2',    'Chemistry 2',                                                    'Grade 11', 'academic', 0.5, 'third'),
('AAC-EARTH1',   'Earth and Space Science 1',                                      'Grade 11', 'academic', 0.5, 'third'),
('AAC-EARTH2',   'Earth and Space Science 2',                                      'Grade 11', 'academic', 0.5, 'first'),
('AAC-FINMATH1', 'Finite Mathematics 1',                                           'Grade 11', 'academic', 0.5, 'first'),
('AAC-FINMATH2', 'Finite Mathematics 2',                                           'Grade 11', 'academic', 0.5, 'second'),
('AAC-PHYS1',    'Physics 1',                                                      'Grade 11', 'academic', 0.5, 'third'),
('AAC-PHYS2',    'Physics 2',                                                      'Grade 11', 'academic', 0.5, 'first'),
('AAC-PE1',      'Physical Education 1 (Fitness and Recreation)',                  'Grade 11', 'academic', 0.5, 'second'),
('AAC-PE2',      'Physical Education 2 (Sports and Dance)',                        'Grade 11', 'academic', 0.5, 'first'),
('AAC-HUMMOV1',  'Human Movement 1 (Basic Anatomy in Sports and Exercise)',        'Grade 11', 'academic', 0.5, 'third'),
('AAC-HUMMOV2',  'Human Movement 2 (Motor Skills Development)',                    'Grade 11', 'academic', 0.5, 'first'),
('AAC-SAM',      'Sports Activity Management',                                     'Grade 11', 'academic', 0.5, 'second'),
('AAC-COACH',    'Sports Coaching',                                                'Grade 11', 'academic', 0.5, 'third'),
('AAC-OFFIC',    'Sports Officiating',                                             'Grade 11', 'academic', 0.5, 'first');

-- 4. Grade 11 — TechPro electives (0.5 unit per term) ---------
INSERT OR IGNORE INTO subjects (code, title, grade_level, track, units, term) VALUES
('STP-CSS',      'Computer Systems Servicing',                            'Grade 11', 'tvl', 0.5, 'first'),
('STP-ANIM',     'Animation',                                             'Grade 11', 'tvl', 0.5, 'first'),
('STP-PROG',     'Programming',                                           'Grade 11', 'tvl', 0.5, 'second'),
('STP-COOK',     'Cookery',                                               'Grade 11', 'tvl', 0.5, 'first'),
('STP-BPP',      'Bread and Pastry Production',                           'Grade 11', 'tvl', 0.5, 'second'),
('STP-FBS',      'Food and Beverage Services',                            'Grade 11', 'tvl', 0.5, 'second'),
('STP-AGRI',     'Agricultural Crops Production',                         'Grade 11', 'tvl', 0.5, 'third'),
('STP-ANIPROD',  'Animal Production',                                     'Grade 11', 'tvl', 0.5, 'third'),
('STP-AUTO',     'Automotive Servicing',                                  'Grade 11', 'tvl', 0.5, 'third'),
('STP-SMAW',     'Shielded Metal Arc Welding',                            'Grade 11', 'tvl', 0.5, 'second'),
('STP-EIM',      'Electrical Installation and Maintenance',               'Grade 11', 'tvl', 0.5, 'third'),
('STP-DRESS',    'Dressmaking',                                           'Grade 11', 'tvl', 0.5, 'first'),
('STP-BEAUTY',   'Beauty Care (Nail Care)',                               'Grade 11', 'tvl', 0.5, 'third'),
('STP-TOURISM',  'Tourism Promotion Services',                            'Grade 11', 'tvl', 0.5, 'first'),
('STP-CAREAD',   'Caregiving (Adult Care)',                               'Grade 11', 'tvl', 0.5, 'first'),
('STP-CARECH',   'Caregiving (Child Care)',                               'Grade 11', 'tvl', 0.5, 'second'),
('STP-HAIR',     'Hairdressing Services',                                 'Grade 11', 'tvl', 0.5, 'third'),
('STP-AGRO',     'Agro-Entrepreneurship',                                 'Grade 11', 'tvl', 0.5, 'first'),
('STP-AQUA',     'Aquaculture',                                           'Grade 11', 'tvl', 0.5, 'second'),
('STP-FISHC',    'Fish Capture Operation',                                'Grade 11', 'tvl', 0.5, 'third'),
('STP-FOODP',    'Food Processing',                                       'Grade 11', 'tvl', 0.5, 'first'),
('STP-ORGANIC',  'Organic Agriculture Production',                        'Grade 11', 'tvl', 0.5, 'second'),
('STP-POULTRY',  'Poultry Production (Chicken)',                          'Grade 11', 'tvl', 0.5, 'third'),
('STP-RUMIN',    'Ruminants Production',                                  'Grade 11', 'tvl', 0.5, 'first'),
('STP-SWINE',    'Swine Production',                                      'Grade 11', 'tvl', 0.5, 'second'),
('STP-GARMENT',  'Garments Artisanry',                                    'Grade 11', 'tvl', 0.5, 'first'),
('STP-WEAVE',    'Handicrafts (Weaving)',                                 'Grade 11', 'tvl', 0.5, 'second'),
('STP-AUTOEL',   'Automotive Servicing (Electrical Repair)',              'Grade 11', 'tvl', 0.5, 'third'),
('STP-AUTOEC',   'Automotive Servicing (Engine and Chassis Repairs)',     'Grade 11', 'tvl', 0.5, 'first'),
('STP-DRIVING',  'Driving and Automotive Servicing',                      'Grade 11', 'tvl', 0.5, 'second'),
('STP-MOTOR',    'Motorcycle and Small Engine Servicing',                 'Grade 11', 'tvl', 0.5, 'third'),
('STP-CARP',     'Carpentry',                                             'Grade 11', 'tvl', 0.5, 'first'),
('STP-CONSTR',   'Construction Operation',                                'Grade 11', 'tvl', 0.5, 'second'),
('STP-DRAFT',    'Technical Drafting',                                    'Grade 11', 'tvl', 0.5, 'first'),
('STP-ILLUS',    'Illustration',                                          'Grade 11', 'tvl', 0.5, 'second'),
('STP-VGD',      'Visual Graphic Design',                                 'Grade 11', 'tvl', 0.5, 'third'),
('STP-BAKERY',   'Bakery Operations',                                     'Grade 11', 'tvl', 0.5, 'first'),
('STP-EVENTS',   'Events Management Services',                            'Grade 11', 'tvl', 0.5, 'second'),
('STP-HOTELFO',  'Hotel Operation (Front Office Services)',               'Grade 11', 'tvl', 0.5, 'first'),
('STP-HOTELHS',  'Hotel Operation (Housekeeping Services)',               'Grade 11', 'tvl', 0.5, 'second'),
('STP-KITCH',    'Kitchen Operations',                                    'Grade 11', 'tvl', 0.5, 'third'),
('STP-BROADBAND','Broadband Installation',                                'Grade 11', 'tvl', 0.5, 'first'),
('STP-JAVA',     'Computer Programming (Java)',                           'Grade 11', 'tvl', 0.5, 'second'),
('STP-DOTNET',   'Computer Programming (.NET Technology)',                'Grade 11', 'tvl', 0.5, 'third'),
('STP-ORACLE',   'Computer Programming (Oracle Database)',                'Grade 11', 'tvl', 0.5, 'first'),
('STP-CONTACT',  'Contact Center Services',                               'Grade 11', 'tvl', 0.5, 'second'),
('STP-AC',       'Commercial Air Conditioning Installation and Servicing','Grade 11', 'tvl', 0.5, 'second'),
('STP-REFRIG',   'Domestic Refrigeration and Air Conditioning Servicing', 'Grade 11', 'tvl', 0.5, 'third'),
('STP-EPAS',     'Electronic Products Assembly and Servicing',            'Grade 11', 'tvl', 0.5, 'first'),
('STP-MECHAT',   'Mechatronics',                                          'Grade 11', 'tvl', 0.5, 'second'),
('STP-PHOTOV',   'Photovoltaic Systems Installation',                     'Grade 11', 'tvl', 0.5, 'third'),
('STP-MARINE',   'Marine Engineering at the Support Level',               'Grade 11', 'tvl', 0.5, 'first'),
('STP-MTRANSPO', 'Marine Transportation at the Support Level',            'Grade 11', 'tvl', 0.5, 'second'),
('STP-SHIPS',    'Ships Catering Services',                               'Grade 11', 'tvl', 0.5, 'third');

-- 5. Grade 12 — Strengthened SHS (new Grade 12 curriculum) ----
INSERT OR IGNORE INTO subjects (code, title, grade_level, track, units, term) VALUES
('S12-CREATPROD', 'Creative Production and Presentation',                    'Grade 12', 'academic', 0.5, 'all'),
('S12-ADVMATH',   'Advanced Mathematics',                                    'Grade 12', 'academic', 0.5, 'all'),
('S12-BCALC',     'Basic Calculus',                                          'Grade 12', 'academic', 0.5, 'all'),
('S12-BIO3',      'Biology 3',                                               'Grade 12', 'academic', 0.5, 'all'),
('S12-BIO4',      'Biology 4',                                               'Grade 12', 'academic', 0.5, 'all'),
('S12-CHEM3',     'Chemistry 3',                                             'Grade 12', 'academic', 0.5, 'all'),
('S12-CHEM4',     'Chemistry 4',                                             'Grade 12', 'academic', 0.5, 'all'),
('S12-CONBIO',    'Conceptual Biology and Earth and Space Science',          'Grade 12', 'academic', 0.5, 'all'),
('S12-CONPHY',    'Conceptual Physics and Chemistry in Daily Life',          'Grade 12', 'academic', 0.5, 'all'),
('S12-DBM',       'Database Management',                                     'Grade 12', 'academic', 0.5, 'all'),
('S12-ESS3',      'Earth and Space Science 3',                               'Grade 12', 'academic', 0.5, 'all'),
('S12-ESS4',      'Earth and Space Science 4',                               'Grade 12', 'academic', 0.5, 'all'),
('S12-EMPOWTECH', 'Empowerment Technologies',                                'Grade 12', 'academic', 0.5, 'all'),
('S12-DATAAN',    'Fundamentals of Data Analytics',                          'Grade 12', 'academic', 0.5, 'all'),
('S12-PHYS3',     'Physics 3',                                               'Grade 12', 'academic', 0.5, 'all'),
('S12-PHYS4',     'Physics 4',                                               'Grade 12', 'academic', 0.5, 'all'),
('S12-PRECALC',   'Pre-Calculus',                                            'Grade 12', 'academic', 0.5, 'all'),
('S12-RESEARCH1', 'Research 1',                                              'Grade 12', 'academic', 0.5, 'all'),
('S12-RESEARCH2', 'Research 2',                                              'Grade 12', 'academic', 0.5, 'all'),
('S12-DESIGN',    'Design and Innovation',                                   'Grade 12', 'academic', 0.5, 'all'),
('S12-FIELDSPORT','In-Campus Field Exposure for Sports',                     'Grade 12', 'academic', 0.5, 'all'),
('S12-APPRDANCE', 'Arts Apprenticeship - Dance',                             'Grade 12', 'academic', 0.5, 'all'),
('S12-APPLIT',    'Arts Apprenticeship - Literary Arts',                     'Grade 12', 'academic', 0.5, 'all'),
('S12-APPMEDIA',  'Arts Apprenticeship - Media Arts',                        'Grade 12', 'academic', 0.5, 'all'),
('S12-APPMUSIC',  'Arts Apprenticeship - Music',                             'Grade 12', 'academic', 0.5, 'all'),
('S12-APPTHEAT',  'Arts Apprenticeship - Theater Arts',                      'Grade 12', 'academic', 0.5, 'all'),
('S12-APPTRAD',   'Arts Apprenticeship - Traditional Cultural Expressions',  'Grade 12', 'academic', 0.5, 'all'),
('S12-APPVISUAL', 'Arts Apprenticeship - Visual Arts',                       'Grade 12', 'academic', 0.5, 'all'),
('S12-EXERSP',    'Exercise and Sports Programming',                         'Grade 12', 'academic', 0.5, 'all'),
('S12-FIRSTAID',  'First Aid',                                               'Grade 12', 'academic', 0.5, 'all'),
('S12-BLS',       'Fundamentals of Basic Life Support',                      'Grade 12', 'academic', 0.5, 'all');

-- 6. Grade 12 — continuity subjects (strand-based curriculum) -
INSERT OR IGNORE INTO subjects (code, title, grade_level, track, units, term) VALUES
('CORE-MIL',       'Media and Information Literacy',                                   'Grade 12', 'academic', 0.5, 'all'),
('CORE-PR2',       'Practical Research 2',                                             'Grade 12', 'academic', 0.5, 'all'),
('CORE-ENTREP',    'Entrepreneurship',                                                 'Grade 12', 'academic', 0.5, 'all'),
('CORE-WORKIMM',   'Work Immersion (Field Study)',                                     'Grade 12', 'general',  1.0, 'all'),
('TVL-EMPOWER',    'Empowerment Technologies',                                         'Grade 12', 'tvl',      1.0, 'all'),
('HUMSS-TRENDS',   'Trends, Networks and Critical Thinking in the 21st Century',      'Grade 12', 'academic', 0.5, 'all'),
('HUMSS-DISS',     'Disciplines and Ideas in the Social Sciences',                    'Grade 12', 'academic', 0.5, 'all'),
('HUMSS-PPG',      'Philippine Politics and Governance',                               'Grade 12', 'academic', 0.5, 'all'),
('HUMSS-DIASS',    'Disciplines and Ideas in the Applied Social Sciences',            'Grade 12', 'academic', 0.5, 'all'),
('HUMSS-CESC',     'Community Engagement, Solidarity and Citizenship',                'Grade 12', 'academic', 0.5, 'all'),
('HUMSS-CRWRTG',   'Creative Writing / Malikhaing Pagsulat',                           'Grade 12', 'academic', 0.5, 'all'),
('STEM-PHYSCI',    'Physical Science',                                                 'Grade 12', 'academic', 0.5, 'all'),
('STEM-GENCHEM2',  'General Chemistry 2',                                              'Grade 12', 'academic', 0.5, 'all'),
('STEM-GENPHYS2',  'General Physics 2',                                                'Grade 12', 'academic', 0.5, 'all'),
('STEM-GENBIO2',   'General Biology 2',                                                'Grade 12', 'academic', 0.5, 'all'),
('STEM-CAPSTONE',  'Research / Capstone Project',                                      'Grade 12', 'academic', 0.5, 'all'),
('ABM-APPECON',    'Applied Economics',                                                'Grade 12', 'academic', 0.5, 'all'),
('ABM-BUSETH',     'Business Ethics and Social Responsibility',                        'Grade 12', 'academic', 0.5, 'all'),
('ABM-FABM2',      'Fundamentals of Accountancy, Business and Management 2',           'Grade 12', 'academic', 0.5, 'all'),
('ABM-BUSFIN',     'Business Finance',                                                 'Grade 12', 'academic', 0.5, 'all');
