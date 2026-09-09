-- 055-password-resets.sql
-- Self-service password reset: single-use, time-limited reset codes.
-- Codes are stored hashed (sha256) and marked used on success; any older
-- unused codes for a user are invalidated by the next reset request, so
-- there is at most one live code per account.

CREATE TABLE password_resets (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT
);

CREATE INDEX idx_password_resets_user ON password_resets(user_id);
CREATE INDEX idx_password_resets_expires ON password_resets(expires_at);