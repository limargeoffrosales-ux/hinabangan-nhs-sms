-- ============================================================
-- 011: AI Document Generator — saved document storage
-- doc_generations = documents generated this week; purged weekly
-- (every Saturday) together with uploaded doc_formats.
-- ============================================================

CREATE TABLE IF NOT EXISTS doc_generations (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'template',
  source_id  TEXT,
  body       TEXT NOT NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_generations_created_at ON doc_generations (created_at);
CREATE INDEX IF NOT EXISTS idx_doc_generations_created_by ON doc_generations (created_by);
