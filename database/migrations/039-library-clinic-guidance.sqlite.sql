-- Migration 039 (SQLite): Guidance module

-- 1. GUIDANCE: Case records
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

-- 2. GUIDANCE: Session notes
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
