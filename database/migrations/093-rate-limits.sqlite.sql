-- Shared rate-limit counters. express-rate-limit's default store is in-memory
-- and per-instance, so behind a load balancer each instance enforces its own
-- limit and the effective limit is (per-instance limit x instances). This table
-- makes limits global: every instance increments the same row, so a limit of N
-- means N across the whole deployment. Rows are keyed by (key, window_start)
-- and pruned by the same sweep that created them.
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start);
