-- Migration 089: DB-backed CSRF tokens
-- CSRF tokens previously lived in an in-memory Map, so every deploy/sleep
-- invalidated all active sessions' tokens (Render free tier sleeps between
-- requests). Persist hashed tokens so they survive restarts; expire + prune in
-- the same table.

CREATE TABLE IF NOT EXISTS csrf_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token_hash)
);

CREATE INDEX IF NOT EXISTS idx_csrf_tokens_user ON csrf_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expiry ON csrf_tokens (expires_at);

-- Clear stale rows left behind by a crash before a TTL sweep could run.
DELETE FROM csrf_tokens WHERE expires_at < now();