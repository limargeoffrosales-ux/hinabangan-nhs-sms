# Monitoring & Observability Setup

This guide covers setting up production monitoring for Hinabangan NHS SMS on Render + Neon.

## 1. Sentry Error Tracking (Recommended)

### Server (Express)
1. Create a Sentry project at https://sentry.io → **Node.js**
2. Copy the **DSN** (looks like `https://xxx@o123.ingest.sentry.io/456`)
3. In Render dashboard → **hinabangan-nhs** → **Environment**:
   - `SENTRY_DSN` = your server DSN
   - `VITE_SENTRY_DSN` = your web DSN (create a separate **React** project in Sentry)
4. Redeploy

The app initializes Sentry automatically when `SENTRY_DSN` is set (`index.js:102-105`).

### Web (React + Vite)
1. In Sentry → **Create Project** → **React**
2. Copy DSN
3. Set `VITE_SENTRY_DSN` in Render environment (same as server or separate)
4. The web build injects it at compile time via Vite

### Verify
- Trigger a test error: visit `/api/v1/health?test_error=1` (if implemented) or check Sentry dashboard after deploy

---

## 2. Render Built-in Metrics (Free)

Render provides basic metrics at no cost:

| Metric | Location | Alert Threshold |
|--------|----------|-----------------|
| CPU Usage | Service → Metrics | > 80% sustained |
| Memory Usage | Service → Metrics | > 80% sustained |
| Response Time (p95) | Service → Metrics | > 2s |
| Error Rate | Service → Metrics | > 1% |
| Request Throughput | Service → Metrics | N/A |

### Setting Alerts
1. Render Dashboard → **hinabangan-nhs** → **Metrics** → **Create Alert**
2. Configure:
   - **CPU > 80%** for 5 min → Email/Slack
   - **Memory > 80%** for 5 min → Email/Slack
   - **Error rate > 1%** for 5 min → Email/Slack

---

## 3. Neon Database Monitoring

### Free Tier Limits
- **Storage**: 3 GB (alert at 2.5 GB)
- **Compute**: 0.5 vCPU, 2 GB RAM (shared)
- **Connections**: ~100 max (pooled)

### Monitoring
1. Neon Dashboard → **Project** → **Monitoring**
2. Key metrics:
   - **Storage used** (GB)
   - **Active connections**
   - **Query duration (p95)**
   - **Cache hit ratio**

### Alerts (via Neon or external)
- Storage > 80% (2.4 GB)
- Connection count > 80
- Query p95 > 500ms

---

## 4. Health Check Endpoint

The app exposes `/api/v1/health` (implemented in `server/src/index.js:276-283`):

```json
{
  "ok": true,
  "service": "meridianed",
  "uptime": 3600,
  "db": "connected"
}
```

- Returns `200` when healthy, `503` when DB disconnected
- Used by Render health checks (configured in `render.yaml`)
- Exempt from operating-hours gate

### External Uptime Monitoring (Free Options)
| Service | Free Tier | Setup |
|---------|-----------|-------|
| UptimeRobot | 50 monitors, 5-min interval | Add `https://hinabangan-nhs.onrender.com/api/v1/health` |
| Better Stack | 10 monitors, 30-sec interval | Same URL |
| Cronitor | 5 monitors | Same URL |

---

## 5. Log Aggregation

### Render Logs
- View in Render Dashboard → **hinabangan-nhs** → **Logs**
- Retention: 7 days (free), 30 days (paid)
- Filter by: `level:error`, `level:warn`

### Structured Logging
The app uses **Pino** with structured JSON logs (`server/src/logger.js`). Key fields:
- `requestId` - correlates request/response
- `userId` - authenticated user
- `method`, `url`, `status`, `ms` - request timing
- `err` - error objects (stack traces)

### Forward to External (Optional)
For long-term retention, forward logs to:
- **Better Stack** (Logtail) - free tier available
- **Datadog** / **New Relic** / **Grafana Loki** - paid
- **Self-hosted**: Vector → Loki → Grafana

---

## 6. Custom Business Metrics (Optional)

Add custom metrics via Sentry or statsd:

| Metric | Description | Implementation |
|--------|-------------|----------------|
| `active_users` | Current logged-in users | Gauge from session store |
| `enrollment_count` | Daily enrollments | Increment on POST `/enrollments` |
| `grade_submissions` | Grades saved per day | Increment on POST `/grades/class` |
| `ai_requests` | AI assistant usage | Increment in `ai.routes.js` |

---

## 7. Alert Escalation

| Severity | Channel | Response Time |
|----------|---------|---------------|
| **Critical** (service down, DB unavailable) | Phone/SMS + Slack | 15 min |
| **Warning** (high CPU, slow queries) | Slack + Email | 1 hour |
| **Info** (deploy success, backup complete) | Slack only | N/A |

---

## 8. Quick Start Checklist

- [ ] Create Sentry projects (Node + React)
- [ ] Add `SENTRY_DSN` and `VITE_SENTRY_DSN` to Render env
- [ ] Enable Render metrics alerts (CPU, Memory, Error Rate)
- [ ] Set up UptimeRobot/Better Stack for `/api/v1/health`
- [ ] Configure Neon storage alert at 2.5 GB
- [ ] Test: deploy, verify health check, trigger test error in Sentry
- [ ] Document on-call contacts in team wiki

---

## 9. Cost Summary (Monitoring Only)

| Tool | Free Tier | Paid Upgrade |
|------|-----------|--------------|
| Sentry | 5k errors/mo, 30-day retention | $26/mo for 100k errors |
| Render Metrics | Included | N/A |
| Neon Monitoring | Included | N/A |
| UptimeRobot | 50 monitors | $7/mo for 1-min checks |
| Better Stack | 10 monitors, 3-day logs | $25/mo for 30-day logs |

**Total free monitoring cost: $0/month**