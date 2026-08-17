-- Migration 031: Curriculum Structure (SQLite version)

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  grade_levels TEXT DEFAULT 'Grade 11,Grade 12',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS competencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  strand_id INTEGER REFERENCES strands(id) ON DELETE SET NULL,
  track_id INTEGER REFERENCES tracks(id) ON DELETE SET NULL,
  grade_level TEXT,
  quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),
  subject_area TEXT,
  competency_type TEXT NOT NULL DEFAULT 'academic' CHECK (competency_type IN ('academic', 'technical', 'applied')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subject_competencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  competency_id INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(subject_id, competency_id)
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  building TEXT,
  floor INTEGER,
  capacity INTEGER NOT NULL DEFAULT 40,
  room_type TEXT NOT NULL DEFAULT 'classroom' CHECK (room_type IN ('classroom', 'laboratory', 'library', 'gymnasium', 'office', 'workshop', 'other')),
  equipment TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subject_prerequisites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  prerequisite_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  required_grade REAL DEFAULT 75,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(subject_id, prerequisite_id)
);

-- Seed tracks
INSERT OR IGNORE INTO tracks (code, name, description) VALUES
  ('ACADEMIC', 'Academic', 'College-bound track'),
  ('TVL', 'Technical-Vocational-Livelihood (TVL)', 'TESDA NCII-aligned track'),
  ('SPORTS', 'Sports', 'Student-athlete track'),
  ('ARTS', 'Arts and Design', 'Creative arts track');

-- Seed strands
INSERT OR IGNORE INTO strands (track_id, code, name, description) VALUES
  ((SELECT id FROM tracks WHERE code = 'ACADEMIC'), 'STEM', 'Science, Technology, Engineering, and Mathematics', 'STEM college prep'),
  ((SELECT id FROM tracks WHERE code = 'ACADEMIC'), 'ABM', 'Accountancy, Business, and Management', 'Business college prep'),
  ((SELECT id FROM tracks WHERE code = 'ACADEMIC'), 'HUMSS', 'Humanities and Social Sciences', 'Humanities college prep'),
  ((SELECT id FROM tracks WHERE code = 'ACADEMIC'), 'GAS', 'General Academic Strand', 'Flexible academic path'),
  ((SELECT id FROM tracks WHERE code = 'TVL'), 'TVL-CS', 'Computer Systems Servicing', 'NCII: CSS NC II'),
  ((SELECT id FROM tracks WHERE code = 'TVL'), 'TVL-EIM', 'Electrical Installation and Maintenance', 'NCII: EIM NC II'),
  ((SELECT id FROM tracks WHERE code = 'TVL'), 'TVL-GA', 'Garment Artisanry', 'NCII: Dressmaking NC II'),
  ((SELECT id FROM tracks WHERE code = 'TVL'), 'TVL-ICT', 'ICT Programming', 'NCII: Programming NC II');

-- Seed rooms
INSERT OR IGNORE INTO rooms (code, name, building, capacity, room_type) VALUES
  ('R-101', 'Room 101', 'Main Building', 45, 'classroom'),
  ('R-102', 'Room 102', 'Main Building', 45, 'classroom'),
  ('R-201', 'Room 201', 'Main Building', 45, 'classroom'),
  ('ICT-LAB', 'ICT Laboratory', 'Annex Building', 40, 'laboratory'),
  ('EIM-LAB', 'Electrical Installation Lab', 'Annex Building', 30, 'workshop'),
  ('LIB', 'Library', 'Main Building', 60, 'library'),
  ('GYM', 'Gymnasium', 'Sports Building', 200, 'gymnasium');
