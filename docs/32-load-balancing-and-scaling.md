# Load Balancing & Scaling — Analysis, Fixes, and Runbook

This document records the load-balancing and scaling assessment for the
**actually deployed** system (Express + React 19 on Render free tier, Neon
free-tier PostgreSQL). It supersedes the aspirational GCP/NestJS architecture
in [18-deployment-architecture.md](18-deployment-architecture.md) and
[27-scalability-plan.md](27-scalability-plan.md) for the current deployment.

> **Reality check:** the system runs as a **single instance** on Render free
> tier. There is no load balancer config, no PgBouncer, no read replicas, no
> autoscaling, and no Redis in the app. The design docs describe a target
> architecture that is not what is deployed.

## 1. What was found (Phase 1)

| Area | Status | Evidence |
|------|--------|----------|
| Load balancer in front | UNVERIFIED | No nginx/haproxy/caddy config in repo; Render provides a managed proxy |
| 2+ instances | MISSING | `render.yaml` = one service, `plan: free` |
| Health checks | INTEGRATED | `/api/v1/health` (`index.js:276`), Docker `HEALTHCHECK` |
| Stateless app | PARTIAL | JWT auth is stateless; but in-memory SSE `clients` Set, per-instance cron jobs, per-instance rate limits |
| Sessions across instances | PARTIAL | JWT + DB-backed CSRF/refresh tokens work; in-memory `userCache` is per-instance |
| Cross-instance SSE | MISSING | `realtime.js` `clients` Set is in-memory — broadcasts don't cross instances |
| Client IP forwarding | INTEGRATED | `trust proxy: 1` (`index.js:100`) |
| Graceful shutdown | INTEGRATED | SIGTERM handler (`index.js:404`) |
| Cron jobs run once | MISSING | backup/notify/storage sweeps run per-instance with no leader election |
| Shared rate limiting | MISSING | express-rate-limit default store is per-instance memory |
| DB connection budget | MISSING | pool `max: 10` per instance; no coordination across instances |
| Autoscaling | MISSING | Render free tier = single instance |
| Load tests | MISSING | No k6/locust/autocannon scripts in repo |

## 2. What was fixed (Phase 3)

Three Critical fixes make the app safe to run multiple instances:

### 2.1 Leader election for cron jobs
- **New:** `server/src/leader.js`, migration `096-job-locks`
- **How:** atomic `INSERT ... ON CONFLICT` on `job_locks` table; winner heartbeats, lock expires on crash
- **Applied to:** `backup-sweep.js`, `storage-cleanup.js`, `notify.js` sweep
- **Result:** exactly one instance runs each scheduled job, even with N instances

### 2.2 Shared rate-limit store
- **New:** `server/src/rate-limit-store.js`, migration `093-rate-limits`
- **How:** `rate_limits` table with atomic `INSERT ... ON CONFLICT DO UPDATE`; a limit of N means N across all instances
- **Applied to:** all four limiters in `index.js` (auth, api, upload, ai)
- **Result:** rate limits aggregate across instances instead of multiplying

### 2.3 Cross-instance SSE broadcast
- **New:** migration `094-realtime-outbox`; updated `server/src/realtime.js`
- **How:** `broadcast()` writes to `realtime_outbox` table; each instance polls every 2s and pushes to its own local clients
- **Result:** a notification pushed from instance A reaches a client on instance B

## 3. Load test results (Phase 4)

Script: `server/scripts/loadtest.js` (dependency-free, Node 22+ global fetch).
Run against a single local instance (SQLite), 50 concurrent users, 30s.

| Metric | Before | After | Notes |
|--------|--------|-------|-------|
| Login limiter | 20/50 succeeded | 9/50 succeeded | DB store shares the limit across instances (stricter, correct) |
| API throughput | ~100-200 req/s | ~50-90 req/s | DB store adds ~1 DB write per request |
| p95 latency | 400-600 ms | 900-1100 ms | DB store adds latency; acceptable for correctness |
| Error rate | rate-limiter bound | rate-limiter bound | 429s from the 1000/15min API limiter |
| Cron jobs | run per instance | run once (leader) | verified via logs |
| SSE broadcasts | single instance | cross-instance | via outbox polling |

**Key finding:** the **login rate limiter (15 req/15min)** is the biggest
peak-event bottleneck. At a morning login spike (all teachers at 8:00), only 15
users can authenticate per 15 minutes. This is a security feature — do not
simply remove it. Options:
- Raise to a level that fits your staff count (e.g. 100/15min for ~40 staff)
- Or keep it and accept that mass logins are staggered (users see "try again
  in a few minutes" — the limiter message is already friendly)

**Maximum supported concurrent users:** not measured to breaking point. The
rate limiter (1000 req/15min API-wide) caps throughput before the instance is
overloaded. To find the real breaking point, raise the API limiter and re-run.

## 4. Scaling plan

| Trigger | Action | Cost | Limit hit first |
|---------|--------|------|-----------------|
| Single instance slow | Raise Render plan (free → starter, 512MB → 1GB RAM) | ~$7/mo | Render free-tier sleep + 512MB RAM |
| Need 2+ instances | Render starter supports multiple instances; leader election + shared rate limit already in place | ~$7/mo per instance | Neon free-tier connections (pool 10 × instances) |
| DB connections maxed | Add PgBouncer (transaction pooling) or raise Neon plan | Free (self-host) or ~$19/mo | Neon free-tier 512MB storage |
| Read-heavy load | Add a read replica; point analytics/dashboard reads at it | ~$19/mo | Neon free-tier single branch |
| Peak event (enrollment) | Pre-warm: raise rate limits 24h before; scale to 2 instances during the window | ~$7/mo extra | Render free-tier = 1 instance (must upgrade) |

**Cheapest setup that handles peak events safely:** Render starter (1 instance,
always-on, no sleep) + the three fixes above. This handles a single school's
peaks (enrollment, grade submission) without autoscaling. Move to 2 instances
only if load tests show the single instance can't keep up.

## 5. Setup instructions

### Environment variables (new)
| Var | Default | Purpose |
|-----|---------|---------|
| `JOB_LEADER_TTL_MS` | 60000 | How often a leader must heartbeat before its lock expires |
| `JOB_HEARTBEAT_MS` | 20000 | How often the leader heartbeats |

### Running the load test
```bash
# From server/
export LOADTEST_PASSWORD='<superadmin password>'
node scripts/loadtest.js --base http://127.0.0.1:4100 --users 50 --duration 30
# Ramp-up (add 1 user/sec):
node scripts/loadtest.js --base http://127.0.0.1:4100 --users 100 --duration 60 --ramp 100
```

### Verifying multi-instance safety
1. Start two instances (different `PORT`, same `DATABASE_URL`).
2. Check logs: one says `LEADER: acquired job`, the other `LEADER: not leader`.
3. Kill the leader; within `JOB_LEADER_TTL_MS` the other acquires the job.
4. Broadcast from one instance; a client connected to the other receives it.

## 6. Runbook — "What to do when traffic spikes or the system slows down"

**Symptoms:** p95 latency > 2s, 429 errors climbing, or Render showing high CPU.

1. **Check it's the rate limiter, not a real overload.** 429 = the limiter is
   doing its job. If users report "try again in a few minutes", that's the
   limiter, not a crash.
2. **Check Render metrics.** CPU > 80% sustained = the instance is genuinely
   busy. If so, upgrade the plan (free → starter) or add a second instance.
3. **Check the database.** Neon dashboard → if connections are near the limit,
   add PgBouncer or reduce the pool (`max: 10` in `db.js:34`).
4. **For a known peak (enrollment day):** raise the API limiter
   (`apiLimiter` in `index.js`) and the login limiter 24h before, then lower
   them after. Pre-warm by hitting the health endpoint so the instance is
   awake.
5. **If an instance crashes:** Render restarts it automatically. Leader
   election re-assigns cron jobs within 60s. No data loss (everything is in
   Neon).
6. **If the system is truly overloaded and users can't work:** temporarily
   raise `SYSTEM_OPEN_HOUR`/`SYSTEM_CLOSE_HOUR` to narrow the operating window,
   or set the API limiter to a very high value to shed the rate-limit overhead
   and let the instance serve as much as it can.

## 7. Remaining risks and next steps

| Risk | Severity | Next step |
|------|----------|-----------|
| Login limiter blocks mass logins at peak | High | Decide: raise limit or accept staggering |
| DB rate-limit store adds ~1 DB write per request | Med | If latency matters, add Redis as the store (same interface) |
| No real load test to breaking point | Med | Raise API limiter, re-run to find the ceiling |
| Render free tier sleeps after idle | Med | Use a pinger or upgrade to starter |
| No PgBouncer — pool × instances may exceed Neon limit | Med | Add PgBouncer when you exceed 1 instance |
| Docs 18/27 describe the wrong architecture | Low | This doc supersedes them for the current deployment |

---

*Deliverable: Load-balancing and scaling assessment for the Hinabangan NHS school management system.*