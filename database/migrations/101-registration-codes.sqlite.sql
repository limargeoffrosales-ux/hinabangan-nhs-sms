-- Migration 101: Superadmin Registration & Access Codes (SQLite mirror)
CREATE TABLE IF NOT EXISTS registration_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'student',
  description TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  used_count  INTEGER DEFAULT 0,
  max_uses    INTEGER DEFAULT 1,
  status      TEXT DEFAULT 'active',
  expires_at  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reg_codes_code ON registration_codes (code);
CREATE INDEX IF NOT EXISTS idx_reg_codes_status ON registration_codes (status);

-- Seed initial registration access code for immediate testing
INSERT INTO registration_codes (code, role, description, max_uses, status)
VALUES ('HNHS-2026-X89A', 'student', 'Initial Registration Access Code', 100, 'active')
ON CONFLICT (code) DO NOTHING;
