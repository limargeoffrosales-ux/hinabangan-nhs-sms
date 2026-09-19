-- 069-self-registration.sql
-- Self-service student portal registration, gated behind registrar approval.
--
-- students.user_id stays the source of truth for the ACTIVE portal link.
-- A learner who already exists in the school records can post /auth/register
-- and, after verifying their LRN + birth date + last name, gets a new
-- student-role login plus a PENDING student_link_requests row. A
-- registrar/school_admin then approves (which writes students.user_id and
-- activates the whole portal) or rejects the request.

CREATE TABLE IF NOT EXISTS student_link_requests (
  id         BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  verified   TEXT NOT NULL DEFAULT '[]',      -- JSON array of matched fields (lrn/birth_date/last_name)
  email      TEXT,
  phone      TEXT,
  notes      TEXT,
  decided_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one live (pending) request per learner and per account.
CREATE UNIQUE INDEX IF NOT EXISTS idx_link_req_pending_student ON student_link_requests (student_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_link_req_pending_user ON student_link_requests (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_link_req_status ON student_link_requests (status, created_at DESC);

-- Public self-registration on/off switch (1 = open, 0 = closed).
INSERT INTO app_settings (key, value) VALUES ('registration_enabled', '1')
ON CONFLICT (key) DO NOTHING;