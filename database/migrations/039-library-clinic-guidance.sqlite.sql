-- Migration 039 (SQLite): Library, Clinic, and Guidance modules

-- 1. LIBRARY: Book catalog
CREATE TABLE IF NOT EXISTS library_books (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT NOT NULL,
  author          TEXT,
  isbn            TEXT,
  category        TEXT,
  publisher       TEXT,
  year_published  INTEGER,
  total_copies    INTEGER NOT NULL DEFAULT 1,
  available_copies INTEGER NOT NULL DEFAULT 1,
  location        TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. LIBRARY: Book loans
CREATE TABLE IF NOT EXISTS book_borrows (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id         INTEGER NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  borrower_type   TEXT NOT NULL CHECK (borrower_type IN ('student', 'teacher')),
  borrower_id     INTEGER NOT NULL,
  borrowed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  borrow_date     TEXT NOT NULL DEFAULT (date('now')),
  due_date        TEXT NOT NULL,
  returned_date   TEXT,
  status          TEXT NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue')),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_borrows_book ON book_borrows(book_id);
CREATE INDEX IF NOT EXISTS idx_borrows_borrower ON book_borrows(borrower_type, borrower_id);
CREATE INDEX IF NOT EXISTS idx_borrows_status ON book_borrows(status);

-- 3. CLINIC: Health visits
CREATE TABLE IF NOT EXISTS clinic_visits (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER REFERENCES students(id) ON DELETE SET NULL,
  teacher_id      INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  visitor_name    TEXT,
  visit_date      TEXT NOT NULL DEFAULT (datetime('now')),
  complaint       TEXT NOT NULL,
  diagnosis       TEXT,
  treatment       TEXT,
  temperature     REAL,
  blood_pressure  TEXT,
  referred_to     TEXT,
  outcome         TEXT NOT NULL DEFAULT 'treated' CHECK (outcome IN ('treated', 'referred', 'sent_home', 'monitoring')),
  recorded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clinic_student ON clinic_visits(student_id);
CREATE INDEX IF NOT EXISTS idx_clinic_date ON clinic_visits(visit_date);

-- 4. CLINIC: Medicine inventory
CREATE TABLE IF NOT EXISTS clinic_medicines (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  category        TEXT,
  quantity        INTEGER NOT NULL DEFAULT 0,
  unit            TEXT DEFAULT 'pieces',
  expiry_date     TEXT,
  supplier        TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'expired')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. CLINIC: Medicine dispensing log
CREATE TABLE IF NOT EXISTS medicine_dispenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id     INTEGER NOT NULL REFERENCES clinic_medicines(id) ON DELETE CASCADE,
  visit_id        INTEGER REFERENCES clinic_visits(id) ON DELETE SET NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  dispensed_to    TEXT,
  dispensed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  dispensed_at    TEXT NOT NULL DEFAULT (datetime('now')),
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_dispenses_medicine ON medicine_dispenses(medicine_id);

-- 6. GUIDANCE: Case records
CREATE TABLE IF NOT EXISTS guidance_cases (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  case_type       TEXT NOT NULL CHECK (case_type IN ('behavioral', 'academic', 'personal', 'career', 'bullying', 'substance', 'other')),
  priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  opened_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_to     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  opened_at       TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at       TEXT,
  summary         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guidance_student ON guidance_cases(student_id);
CREATE INDEX IF NOT EXISTS idx_guidance_status ON guidance_cases(status);
CREATE INDEX IF NOT EXISTS idx_guidance_type ON guidance_cases(case_type);

-- 7. GUIDANCE: Session notes
CREATE TABLE IF NOT EXISTS guidance_sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id         INTEGER NOT NULL REFERENCES guidance_cases(id) ON DELETE CASCADE,
  session_date    TEXT NOT NULL DEFAULT (datetime('now')),
  session_type    TEXT NOT NULL CHECK (session_type IN ('counseling', 'assessment', 'follow_up', 'parent_meeting', 'referral')),
  notes           TEXT NOT NULL,
  action_items    TEXT,
  conducted_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gsession_case ON guidance_sessions(case_id);
