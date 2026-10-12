# Disaster Recovery Plan — Free-Tier Reality Edition

**System:** Hinabangan NHS School Management System (MeridianEd)
**Stack:** Express API (Node 22) + React 19 SPA + PostgreSQL (Neon free) + Cloudflare R2
**Hosting:** Render free tier (single web service, sleeps after 15 min idle)
**Last Updated:** 2026-10-11

---

## 1. Honest Recovery Targets (measured, not aspirational)

| Metric | Target | Reality / Notes |
|--------|--------|-----------------|
| **Availability** | On-demand (not 99.x%) | Free tier sleeps → cold start ~60s; no SLA |
| **RPO** | ≤ 24 hours | Daily automated backup; no PITR on Neon free |
| **RTO — DB failure** | ≤ 30 minutes | Restore from R2 backup to new Neon branch + repoint DATABASE_URL |
| **RTO — App failure** | ≤ 15 minutes | Render auto-restarts crashed service; new deploy ~5 min |
| **RTO — Total loss (R2 + Neon + Render)** | ≤ 2 hours | Provision new Neon + Render, restore from R2, re-deploy |
| **RTO — File storage** | ≤ 1 hour | R2 versioning (if enabled) + re-sync from backup |

---

## 2. What We Actually Have (Free Tier)

| Layer | Production | Failure Mode | Recovery |
|-------|------------|--------------|----------|
| **API** | Render free web service | Sleeps, crashes, cold starts | Auto-restart; rollback deploy |
| **Database** | Neon free (512 MB, single branch) | Cap hit (53100), corruption, region outage | Daily R2 backup restore; no PITR |
| **Files** | Cloudflare R2 | Accidental delete, overwrite | **Enable R2 versioning** (dashboard) |
| **Backups** | In-app sweep → local + R2 | Sweep fails, R2 not configured | Manual `npm run backup` + drill |
| **Secrets** | Render env vars | Dashboard access lost | `.env.example` + docs/32-runbook.md |

---

## 3. Failure Scenarios & Runbooks

### T1: Render Service Down (most common)
**Trigger:** Health check 503, site unreachable, Sentry errors
**Cause:** Crash, OOM, deploy failure, free-tier sleep
**RTO:** 5–15 min (auto) / 30 min (manual rollback)
**Runbook:**
1. Render dashboard → check status (Live / Sleeping / Crashed)
2. If **Sleeping**: wait 60s, retry (free tier behavior)
3. If **Crashed**: check logs → "Fatal boot error" / OOM / 53100
4. If **Deploy failed**: Rollback → previous successful deploy
5. If **OOM**: check memory leaks; Render free = 512 MB RAM

### T2: Neon Database Down / At Capacity
**Trigger:** `/api/v1/health` → 503 `db: "disconnected"`, "53100" in logs
**Cause:** Region outage, 512 MB cap, corruption
**RTO:** 15–60 min (restore from R2 backup to new branch)
**Runbook:**
1. Neon dashboard → check project status (region healthy?)
2. If **cap hit (53100)**:
   - Logs show PRUNE/VACUUM running automatically
   - If still at cap: manual `npm run backup` → creates dump
   - Delete old data: `DELETE FROM audit_logs WHERE created_at < now() - interval '90 days'` etc.
3. If **region outage / corruption**:
   - Provision new Neon branch/project (different region if needed)
   - Restore latest R2 backup: `node scripts/backup.js --restore FILE --yes --bootstrap`
   - Update Render `DATABASE_URL` → new connection string
   - Verify: `npm run backup:drill` + smoke test
4. App auto-reconnects when DB reachable (no code deploy needed)

### T3: Cloudflare R2 Issues
**Trigger:** Upload/download fails, backup can't write to R2
**Cause:** Quota exceeded, credentials wrong, region outage
**RTO:** Local backups only until R2 restored
**Runbook:**
1. Check R2 dashboard → quota, credentials
2. If credentials: update Render env vars (`R2_ACCESS_KEY`, `R2_SECRET_KEY`)
3. If quota: delete old objects or upgrade plan
4. Local backups still run (ephemeral on Render disk — survive only until next deploy)
5. **Enable R2 versioning** to protect against accidental deletes

### T4: Accidental Data Deletion / Corruption
**Trigger:** User/admin reports missing records, grades gone
**Cause:** Bug, bad migration, human error, ransomware
**RPO:** Up to 24h (last backup)
**Runbook:**
1. Check audit trail: `GET /api/v1/audit?q=DELETE` or `q=GRADE`
2. If within 24h: restore from latest backup (see Restore procedure)
3. If > 24h: Neon free keeps limited WAL history → check Neon PITR
4. If ransomware: isolate, don't pay, restore from clean backup, rotate all secrets

### T5: Total Vendor Outage (Render + Neon + R2)
**Trigger:** All three down simultaneously (extremely rare)
**RTO:** 1–2 hours (provision new everything)
**Runbook:**
1. Provision new Neon project (any region)
2. Provision new Render web service (connect to GitHub)
3. Set env vars from `.env.example` + secrets from password manager
4. Restore from R2 backup: `--restore --bootstrap`
5. Verify drill, smoke test, update DNS if custom domain

---

## 4. Backup & Restore Procedure (The Safety Net)

**Automated (in-app, no cron needed):**
- Runs every 24h at boot + interval (`BACKUP_INTERVAL_HOURS`)
- Consistent logical dump (PG: serializable RO txn; SQLite: VACUUM INTO)
- Gzipped JSON: `meridianed-<timestamp>.json.gz`
- Stored locally (`<DATA_DIR>/backups`) + R2 (`backups/meridianed/`)
- Retains newest 5 (`BACKUP_RETAIN`)

**Verification (drill):**
- `npm run backup:drill` → restores to throwaway schema, re-dumps, diffs every table
- Runs automatically after each backup if `BACKUP_DRILL_ENABLED=1`
- **PASS = all 90+ tables identical row-for-row**

**Manual Restore:**
```bash
# 1. Stop app (Render: scale to 0)
# 2. List available
npm run backup:list
# 3. Restore (replaces live data!)
node scripts/backup.js --restore meridianed-2026-10-11T04-00-00.json.gz --yes --bootstrap
# 4. Verify
npm run backup:drill
# 5. Restart app
```

---

## 5. Monitoring & Alerting (What Actually Exists)

| What | Tool | Alert To |
|------|------|----------|
| App health | Render health check (30s interval) | Render email |
| Backup success/fail/drill | In-app `opsAlert()` | Email/SMS to super_admin |
| Backup stale/small/empty | `checkBackupHealth()` (every 6h) | Email/SMS to super_admin |
| DB size near cap | Boot + periodic log | Log warning + `opsAlert` |
| Sentry errors | Sentry (if DSN configured) | Sentry alert rules → email |
| Uptime | **NOT CONFIGURED** — see `docs/33-setup-checklist.md` §3 (UptimeRobot free) | You |

---

## 6. Team Roles & Escalation

| Role | Responsibility | Contact |
|------|----------------|---------|
| **Primary Ops** | Monitor, triage, execute runbooks | The `super_admin` account (all `opsAlert` emails); set its email/phone in-app → Settings → Accounts |
| **Backup Ops** | Cover when primary unavailable | Second `super_admin`/staff account (create via Accounts) |
| **DB Admin** | Neon management, restores, capacity | Neon project owner — holds `DATABASE_URL` on Render |
| **School Admin** | User communication, data validation | Hinabangan NHS school head / principal (in-person) |

**Escalation:**
1. Primary Ops acknowledges within 15 min (business hours) / 1 hour (off-hours)
2. If unresolved in 30 min → Backup Ops + DB Admin
3. If data loss confirmed → School Admin + legal (DPA notification if PII)

---

## 7. Communication Templates

**Outage Notice (to school staff):**
> Subject: School Portal — Temporary Outage
> The school management portal is currently experiencing issues. Our team is investigating. Expected resolution: [TIME]. We will update by [TIME]. For urgent grade/attendance needs, contact the registrar directly.

**Data Loss Notice (if confirmed):**
> Subject: IMPORTANT — Data Incident Affecting [scope]
> A data incident occurred on [DATE] affecting [specific records]. We have restored from backup dated [DATE] (up to 24h of changes may be lost). Affected users: [list]. No passwords or financial data were exposed. Contact [NAME] for questions.

---

## 8. Post-Incident Review (within 5 business days)

1. Reconstruct timeline from Render logs + Sentry + `audit_logs`
2. Measure actual RPO (last backup age) vs 24h target
3. Measure actual RTO (detection → recovery) vs targets above
4. Root cause: infrastructure / code / human / security
5. Corrective actions with owners + 30-day SLA
6. Update this doc + runbook if new scenario

---

## 9. What Is NOT Covered (Accepted Risks)

- **Neon free tier PITR** — not available; daily backup is the floor
- **Render free tier cold starts** — 60s delay after idle; not "high availability"
- **Single region** — Neon + Render + R2 all in one region (US East typically)
- **No auto-failover** — all recovery is manual/decision-gated
- **Ransomware on R2** — versioning mitigates; no immutable WORM on free tier
- **DNS provider outage** — not monitored; use Cloudflare free if custom domain

---

## 10. Quick Reference Commands

```bash
# Local / Render shell
npm run backup              # create backup now
npm run backup:list         # list local backups
npm run backup:drill        # verify latest backup restores correctly
npm run backup:cleanup 10   # keep 10 newest (local + R2)
node scripts/backup.js --restore FILE --yes --bootstrap  # RESTORE (stop app first!)
node scripts/backup.js --verify FILE                     # integrity check only

# Health check
curl https://your-app.onrender.com/api/v1/health

# DB size (Neon)
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
```

---

**Bottom Line:** This is a free-tier, single-region system with daily backups to R2. RPO = 24h, RTO = hours. The backup drill is your proof it works — run it monthly. The runbook (docs/32-operations-runbook.md) is your go-to during an incident.