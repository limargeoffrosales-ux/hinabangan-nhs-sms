-- Leader election for in-process scheduled jobs (backup, storage cleanup,
-- notify sweep). Without this, every app instance runs the sweeps and you get
-- N backups / N cleanups for N instances. A row is claimed with a plain INSERT;
-- the winner is the only instance whose INSERT succeeds. The winner heartbeats
-- (updates heartbeat_at) so a crashed leader's lock expires and another
-- instance takes over. expires_at = heartbeat_at + LEADER_TTL_MS.
CREATE TABLE IF NOT EXISTS job_locks (
  job_name     TEXT PRIMARY KEY,
  instance_id  TEXT NOT NULL,
  acquired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_locks_expires ON job_locks (expires_at);