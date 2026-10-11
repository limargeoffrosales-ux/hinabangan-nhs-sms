-- Cross-instance SSE outbox. The realtime module keeps connected clients in an
-- in-memory Set, so a broadcast only reaches clients on the SAME instance.
-- Behind a load balancer that means a notification pushed from instance A never
-- reaches a client on instance B. This table is the outbox: broadcast() writes
-- a row, every instance polls for rows it hasn't seen, and pushes them to its
-- own local clients. Old rows are pruned by the same sweep.
CREATE TABLE IF NOT EXISTS realtime_outbox (
  id         BIGSERIAL PRIMARY KEY,
  type       TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_realtime_outbox_id ON realtime_outbox (id);
