-- ============================================================
-- 005: Immersion & programs modules (PostgreSQL)
-- Teacher daily attendance, Work Immersion, JDVP recipients
-- ============================================================

CREATE TABLE IF NOT EXISTS teacher_attendance (
  id          BIGSERIAL PRIMARY KEY,
  teacher_id  BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'present',
  remarks     TEXT,
  recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, date)
);

CREATE TABLE IF NOT EXISTS work_immersion (
  id                 BIGSERIAL PRIMARY KEY,
  student_id         BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch              TEXT NOT NULL,
  program            TEXT NOT NULL DEFAULT 'Academic',
  partner_institution TEXT,
  status             TEXT NOT NULL DEFAULT 'ongoing',
  start_date         TEXT,
  end_date           TEXT,
  remarks            TEXT,
  recorded_by        BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, batch, program)
);
CREATE INDEX IF NOT EXISTS idx_immersion_batch ON work_immersion (batch, program);

CREATE TABLE IF NOT EXISTS jdvp_recipients (
  id          BIGSERIAL PRIMARY KEY,
  student_id  BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch       TEXT NOT NULL,
  program     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  remarks     TEXT,
  recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, batch)
);
CREATE INDEX IF NOT EXISTS idx_jdvp_batch ON jdvp_recipients (batch);