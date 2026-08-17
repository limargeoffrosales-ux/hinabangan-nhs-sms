-- Migration 031: Curriculum Structure (Tracks, Strands, Competencies, Rooms)
-- Adds structured curriculum management for Academic + TVL-TechPro SHS tracks

-- ── Tracks ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracks (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  grade_levels TEXT DEFAULT 'Grade 11,Grade 12',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Strands ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS strands (
  id BIGSERIAL PRIMARY KEY,
  track_id BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Competencies (MELC-aligned) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS competencies (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  strand_id BIGINT REFERENCES strands(id) ON DELETE SET NULL,
  track_id BIGINT REFERENCES tracks(id) ON DELETE SET NULL,
  grade_level TEXT,
  quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),
  subject_area TEXT,
  competency_type TEXT NOT NULL DEFAULT 'academic' CHECK (competency_type IN ('academic', 'technical', 'applied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Subject ↔ Competency mapping ─────────────────────────────────
CREATE TABLE IF NOT EXISTS subject_competencies (
  id BIGSERIAL PRIMARY KEY,
  subject_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  competency_id BIGINT NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subject_id, competency_id)
);

-- ── Rooms ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  building TEXT,
  floor INTEGER,
  capacity INTEGER NOT NULL DEFAULT 40,
  room_type TEXT NOT NULL DEFAULT 'classroom' CHECK (room_type IN ('classroom', 'laboratory', 'library', 'gymnasium', 'office', 'workshop', 'other')),
  equipment TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Subject prerequisites ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subject_prerequisites (
  id BIGSERIAL PRIMARY KEY,
  subject_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  prerequisite_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  required_grade NUMERIC(5,2) DEFAULT 75,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subject_id, prerequisite_id)
);

-- ── Seed DepEd SHS Tracks ────────────────────────────────────────
INSERT INTO tracks (code, name, description, grade_levels) VALUES
  ('ACADEMIC', 'Academic', 'College-bound track for higher education', 'Grade 11,Grade 12'),
  ('TVL', 'Technical-Vocational-Livelihood (TVL)', 'Competency-based track aligned with TESDA NCII standards', 'Grade 11,Grade 12'),
  ('SPORTS', 'Sports', 'For student-athletes', 'Grade 11,Grade 12'),
  ('ARTS', 'Arts and Design', 'For creatively inclined students', 'Grade 11,Grade 12')
ON CONFLICT (code) DO NOTHING;

-- ── Seed DepEd SHS Strands ───────────────────────────────────────
INSERT INTO strands (track_id, code, name, description) VALUES
  -- Academic
  ((SELECT id FROM tracks WHERE code = 'ACADEMIC'), 'STEM', 'Science, Technology, Engineering, and Mathematics', 'Prepares students for STEM-related college programs'),
  ((SELECT id FROM tracks WHERE code = 'ACADEMIC'), 'ABM', 'Accountancy, Business, and Management', 'Prepares students for business and management programs'),
  ((SELECT id FROM tracks WHERE code = 'ACADEMIC'), 'HUMSS', 'Humanities and Social Sciences', 'Prepares students for social science and humanities programs'),
  ((SELECT id FROM tracks WHERE code = 'ACADEMIC'), 'GAS', 'General Academic Strand', 'Flexible strand for students still deciding on a college path'),
  -- TVL
  ((SELECT id FROM tracks WHERE code = 'TVL'), 'TVL-CS', 'Computer Systems Servicing', 'NCII: Computer Systems Servicing NC II'),
  ((SELECT id FROM tracks WHERE code = 'TVL'), 'TVL-EIM', 'Electrical Installation and Maintenance', 'NCII: Electrical Installation and Maintenance NC II'),
  ((SELECT id FROM tracks WHERE code = 'TVL'), 'TVL-GA', 'Garment Artisanry', 'NCII: Dressmaking/Tailoring NC II'),
  ((SELECT id FROM tracks WHERE code = 'TVL'), 'TVL-HOME-ECON', 'Home Economics', 'NCII: Cookery, Food and Beverage, Tourism'),
  ((SELECT id FROM tracks WHERE code = 'TVL'), 'TVL-IA', 'Industrial Arts', 'NCII: Welding, Automotive, Machining'),
  ((SELECT id FROM tracks WHERE code = 'TVL'), 'TVL-AGRI', 'Agri-Fishery Arts', 'NCII: Agricultural Crop Production, Aquaculture'),
  ((SELECT id FROM tracks WHERE code = 'TVL'), 'TVL-ICT', 'ICT Programming', 'NCII: Programming NC II'),
  -- Sports
  ((SELECT id FROM tracks WHERE code = 'SPORTS'), 'SPORTS-GEN', 'Sports Track', 'For student-athletes across sports disciplines'),
  -- Arts
  ((SELECT id FROM tracks WHERE code = 'ARTS'), 'ARTS-PERF', 'Performing Arts', 'Music, Theater, Dance'),
  ((SELECT id FROM tracks WHERE code = 'ARTS'), 'ARTS-VIS', 'Visual Arts', 'Painting, Sculpture, Digital Arts')
ON CONFLICT (code) DO NOTHING;

-- ── Seed rooms ───────────────────────────────────────────────────
INSERT INTO rooms (code, name, building, capacity, room_type) VALUES
  ('R-101', 'Room 101', 'Main Building', 45, 'classroom'),
  ('R-102', 'Room 102', 'Main Building', 45, 'classroom'),
  ('R-103', 'Room 103', 'Main Building', 45, 'classroom'),
  ('R-104', 'Room 104', 'Main Building', 45, 'classroom'),
  ('R-105', 'Room 105', 'Main Building', 45, 'classroom'),
  ('R-201', 'Room 201', 'Main Building', 45, 'classroom'),
  ('R-202', 'Room 202', 'Main Building', 45, 'classroom'),
  ('R-203', 'Room 203', 'Main Building', 45, 'classroom'),
  ('R-204', 'Room 204', 'Main Building', 45, 'classroom'),
  ('R-205', 'Room 205', 'Main Building', 45, 'classroom'),
  ('ICT-LAB', 'ICT Laboratory', 'Annex Building', 40, 'laboratory'),
  ('EIM-LAB', 'Electrical Installation Lab', 'Annex Building', 30, 'workshop'),
  ('GA-LAB', 'Garment Artisanry Lab', 'Annex Building', 30, 'workshop'),
  ('SCI-LAB', 'Science Laboratory', 'Main Building', 35, 'laboratory'),
  ('LIB', 'Library', 'Main Building', 60, 'library'),
  ('GYM', 'Gymnasium', 'Sports Building', 200, 'gymnasium')
ON CONFLICT (code) DO NOTHING;
