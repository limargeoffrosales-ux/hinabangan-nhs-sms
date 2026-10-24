-- Migration 039: Guidance module

-- 1. GUIDANCE: Case records
CREATE TABLE IF NOT EXISTS guidance_cases (
  id              BIGSERIAL PRIMARY KEY,
  student_id      BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  case_type       TEXT NOT NULL CHECK (case_type IN ('behavioral', 'academic', 'personal', 'career', 'bullying', 'substance', 'other')),
  priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  opened_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  assigned_to     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  summary         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guidance_student ON guidance_cases(student_id);
CREATE INDEX IF NOT EXISTS idx_guidance_status ON guidance_cases(status);
CREATE INDEX IF NOT EXISTS idx_guidance_type ON guidance_cases(case_type);

-- 2. GUIDANCE: Session notes
CREATE TABLE IF NOT EXISTS guidance_sessions (
  id              BIGSERIAL PRIMARY KEY,
  case_id         BIGINT NOT NULL REFERENCES guidance_cases(id) ON DELETE CASCADE,
  session_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_type    TEXT NOT NULL CHECK (session_type IN ('counseling', 'assessment', 'follow_up', 'parent_meeting', 'referral')),
  notes           TEXT NOT NULL,
  action_items    TEXT,
  conducted_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gsession_case ON guidance_sessions(case_id);
