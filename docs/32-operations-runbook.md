# One-Page Runbook: What to Do When the System Is Down, Slow, Showing Errors, or Data Is Lost

**System:** Hinabangan NHS School Management System (MeridianEd)
**Hosting:** Render (API) + Neon (PostgreSQL) + Cloudflare R2 (files)
**Last Updated:** 2026-10-11

---

## 📞 Emergency Contacts

| Role | Who It Resolves To |
|------|--------------------|
| **Primary Ops** | The `super_admin` account — every `opsAlert` email lands here; set its email & phone in-app under Settings → Accounts |
| **Backup Ops** | Second `super_admin`/staff account (create one for coverage; alerts only reach accounts that exist) |
| **DB Admin** | Neon project owner (Neon dashboard → project → settings; also holds `DATABASE_URL`) |
| **School Admin** | Hinabangan NHS school head / principal (in-person escalation, not in-app) |

> To alert a personal phone too: set the superadmin's phone number in-app **and** configure `SMS_PROVIDER_URL`/`SMS_PROVIDER_TOKEN` (or `textbelt`) on Render.

---

## 🚨 Quick Triage (≤ 5 min)

| Symptom | Likely Cause | First Check |
|---------|--------------|-------------|
| **Site won't load / 502/503** | Render sleeping (free tier) or crashed | Open Render dashboard → check service status |
| **Health endpoint 503** | Database down | `curl https://your-app.onrender.com/api/v1/health` |
| **Slow / timeouts** | Neon near 512 MB cap or long query | Render logs → search "db size" / "PRUNE" |
| **Sentry errors spike** | New deploy bug | Sentry → check latest release |
| **User reports "can't login"** | Locked account / wrong password | Audit logs → `LOGIN_FAILED` / `security_incidents` |

---

## 🔧 Common Fixes

### 1. System Down / Won't Load
```
1. Check Render dashboard: is the service "Live" or "Sleeping"?
2. If Sleeping: free tier spins down after 15 min idle → wait 60s cold start
3. If Crashed: check Render logs → "Fatal boot error" or "53100" (Neon cap)
4. Neon 512 MB cap: see "Database at Capacity" below
5. If deploy failed: rollback in Render → "Rollback to previous deploy"
```

### 2. Health Endpoint Returns 503 (`db: "disconnected"`)
```
1. Neon dashboard → check project status
2. If Neon down: wait for Neon recovery (usually < 10 min)
3. If up but app can't connect: check Render env var DATABASE_URL is correct
4. App auto-reconnects when DB comes back (no restart needed)
```

### 3. Database at Capacity (Neon 512 MB free tier)
```
Symptoms: "53100" in logs, PRUNE/VACUUM running, slow queries
1. Render logs → search "PRUNE" / "VACUUM" / "db size"
2. If auto-prune didn't free enough: manual vacuum
   → Run in Render shell: `npm run backup` (creates consistent dump)
   → Then: `npm run backup:drill` (verifies restore works)
3. If still at cap: delete old audit/notification data via SQL (see db.js pruneStatements)
4. Long term: upgrade Neon plan or enable PITR
```

### 4. Users See Errors / 500s
```
1. Check Sentry (if DSN configured) → filter by latest release
2. Render logs → search "Unhandled error" / "500"
3. Common: malformed JSON → 400 "Invalid JSON body" (client issue)
4. If new deploy: rollback in Render dashboard
5. If specific endpoint: check rate limits (auth 20/15min, API 1000/15min)
```

### 5. Data Loss / Accidental Deletion
```
1. Check latest backup: `npm run backup:list` (local) or R2 console
2. If backup exists (< 24h old): `npm run backup:drill` to verify
3. Restore: `node scripts/backup.js --restore FILE --yes --bootstrap`
   (run with server STOPPED — use Render "Scale to 0" temporarily)
4. No backup? Neon free tier keeps limited history → check Neon PITR
5. Audit trail: GET /api/v1/audit?q=ACTION for who/what/when
```

### 6. Slow Performance
```
1. Render metrics → CPU/Memory (free tier: 512 MB RAM, shared CPU)
2. Neon dashboard → storage size, active connections
3. Render logs → search "slow" or query duration > 2000ms
4. If DB: check missing indexes (migrations 088, 093)
5. If API: check for N+1 queries in dashboard/analytics endpoints
```

---

## 🔁 Recovery Procedures

### Automated Backup + Drill
- **Frequency:** every 24h (BACKUP_INTERVAL_HOURS)
- **Retention:** 5 newest (BACKUP_RETAIN)
- **Location:** local disk + R2 (if R2_* configured)
- **Verify:** `npm run backup:drill` → "RESTORE DRILL PASS" = good

### Manual Backup Now
```bash
# On Render shell or local
npm run backup
```

### Restore from Backup
```bash
# 1. Stop app (Render: scale to 0)
# 2. List backups
npm run backup:list
# 3. Restore (replaces live data!)
node scripts/backup.js --restore meridianed-2026-10-11T04-00-00.json.gz --yes --bootstrap
# 4. Verify
npm run backup:drill
# 5. Restart app (Render: scale to 1)
```

### Rollback Deploy
```
Render Dashboard → your service → Deploys → "Rollback" on previous successful deploy
```

---

## 📊 Monitoring & Alerts (what watches what)

| What | Tool | Threshold | Notification |
|------|------|-----------|--------------|
| App health | Render health check | /api/v1/health ≠ 200 | Render email |
| Backup success/fail | In-app + opsAlert | failure, drill FAIL, stale > 48h, size < 1KB | Email/SMS to super_admin |
| Sentry errors | Sentry (if DSN set) | new error, error rate spike | Sentry alert rules → email |
| DB size near cap | In-app log | > 384 MB (75%) | Log warning + opsAlert |
| Uptime | **YOU SET UP** (UptimeRobot free) — see `docs/33-setup-checklist.md` | 5 min down | Email/Telegram/Slack |

---

## ⚙️ Key Environment Variables (Render Dashboard)

| Var | Purpose | Required |
|-----|---------|----------|
| `DATABASE_URL` | Neon PostgreSQL | YES |
| `JWT_SECRET` | Auth signing | YES (auto-generated) |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Error tracking | Recommended |
| `R2_ENDPOINT/BUCKET/ACCESS_KEY/SECRET_KEY` | File storage + backup off-server | Recommended |
| `BACKUP_ENABLED=1` | Auto backups | Recommended |
| `BACKUP_DRILL_ENABLED=1` | Verify restores | Recommended |
| `SMTP_*` / `MAIL_FROM` | Password reset emails | Required for forgot-password |
| `SEED_ON_BOOT=1` | Idempotent seed on boot | YES |

---

## 📋 Post-Incident Checklist

- [ ] Timeline reconstructed from logs (Render + Sentry + audit_logs)
- [ ] Actual RTO/RPO measured vs targets (RPO 24h, RTO hours)
- [ ] Root cause classified: infra / code / security / human
- [ ] Corrective actions with owners + due dates
- [ ] Runbook updated if new scenario discovered
- [ ] Stakeholders informed (school admin, parents if student data affected)

---

## 📁 Related Docs

| Doc | Purpose |
|-----|---------|
| `docs/19-backup-strategy.md` | Backup mechanics, RPO/RTO, drill procedure |
| `docs/20-disaster-recovery.md` | Full DR plan (targets rewritten to match free-tier reality) |
| `docs/33-setup-checklist.md` | One-time setup: Sentry, R2, UptimeRobot, alert recipients |
| `server/scripts/backup.js` | CLI: backup, list, restore, drill, verify |
| `server/src/backup-sweep.js` | Automated sweep + health monitor |
| `server/src/notify.js` | Ops alerts (opsAlert) + notification engine |

---

**Remember:** Free tier = cold starts, no PITR, single region. Plan for hours of RTO, 24h RPO. The backup in R2 is your safety net — verify it works with `npm run backup:drill`.