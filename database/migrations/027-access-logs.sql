CREATE TABLE IF NOT EXISTS data_access_logs (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  username      TEXT,
  student_id    BIGINT,
  action        TEXT NOT NULL DEFAULT 'STUDENT_VIEW',
  ip            TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dal_student ON data_access_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_dal_user ON data_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_dal_created ON data_access_logs(created_at DESC);
