# Deployment & Rollback Runbook
**Hinabangan NHS School Management System**
*Version: 1.0 | Last Updated: 2026-10-11*

---

## Quick Reference

| Environment | URL | Render Service | Database |
|-------------|-----|----------------|----------|
| **Production** | `https://hinabangan-nhs.onrender.com` | `hinabangan-nhs` | Neon `main` branch |
| **Staging** | `https://hinabangan-nhs-staging.onrender.com` | `hinabangan-nhs-staging` | Neon `staging` branch |

**Deploy Trigger**: Push to `main` branch → CI runs → Auto-deploy staging → Manual approval → Deploy prod

---

## 1. Prerequisites

### Accounts Needed
- GitHub (repo admin)
- Render (owner/admin on `hinabangan-nhs` team)
- Neon (project owner)
- Cloudflare R2 (for uploads/backups - optional but recommended)

### Secrets (Configure in GitHub → Settings → Secrets)
| Secret | Description | Where Used |
|--------|-------------|------------|
| `RENDER_STAGING_DEPLOY_HOOK_URL` | Render deploy hook for staging | CI: `deploy-staging` job |
| `RENDER_PROD_DEPLOY_HOOK_URL` | Render deploy hook for production | CI: `deploy-prod` job |
| `SLACK_WEBHOOK_URL` | Optional: failure notifications | CI: `notify-failure` job |
| `SENTRY_DSN` | Server error tracking | Render env var |
| `VITE_SENTRY_DSN` | Web error tracking | Render env var |

### Render Environment Variables (Set in Dashboard)
| Variable | Staging | Production | Notes |
|----------|---------|------------|-------|
| `DATABASE_URL` | Neon staging branch | Neon main branch | **Never commit** |
| `APP_URL` | `https://hinabangan-nhs-staging.onrender.com` | `https://hinabangan-nhs.onrender.com` | For password reset links |
| `JWT_SECRET` | Auto-generated | Auto-generated | Render generates on first deploy |
| `SUPERADMIN_PASSWORD` | Set once before first deploy | Set once before first deploy | 8+ chars, ignored after first boot |
| `SMTP_*` | Optional | Required for prod | Email notifications |
| `R2_*` | Optional | Recommended | File uploads/backups |

---

## 2. Deployment Flow

```mermaid
graph LR
    A[Push to main] --> B[CI: Quality Gate]
    B --> C{Pass?}
    C -->|No| D[Fix & Push]
    C -->|Yes| E[Deploy Staging]
    E --> F[Manual Approval]
    F -->|Approve| G[Deploy Production]
    F -->|Reject| H[Fix & Push]
    G --> I[Verify Health]
    I --> J[Smoke Test]
```

### Step-by-Step

#### 1. Developer Pushes to Main
```bash
git add .
git commit -m "feat: description of changes"
git push origin main
```

#### 2. CI Runs Automatically (GitHub Actions)
- **Quality Gate** (`check` job):
  - `npm ci` (install deps)
  - `gitleaks` (secret scan)
  - `npm audit --audit-level=high` (vulnerability scan)
  - `npm run check` (lint, typecheck, build, i18n, tests)
- **Time**: ~3-5 minutes
- **Failure**: Check Actions tab, fix, push again

#### 3. Staging Auto-Deploys
- Triggered by `deploy-staging` job after `check` passes
- Calls `RENDER_STAGING_DEPLOY_HOOK_URL`
- Render builds & deploys `hinabangan-nhs-staging`
- **Time**: ~5-10 minutes (free tier cold start)

#### 4. Manual Approval Required
- GitHub Actions pauses at `approval` job
- Review staging: `https://hinabangan-nhs-staging.onrender.com`
- Run smoke tests (see Section 4)
- Click **Approve** in Actions UI to continue

#### 5. Production Deploys
- Triggered by `deploy-prod` job after approval
- Calls `RENDER_PROD_DEPLOY_HOOK_URL`
- Render builds & deploys `hinabangan-nhs`
- **Time**: ~5-10 minutes

#### 6. Post-Deploy Verification
- Check health: `https://hinabangan-nhs.onrender.com/api/v1/health`
- Verify login works with test account
- Check Render logs for errors

---

## 3. Rollback Procedure

### Option A: Render Dashboard (Fastest, ~2 min)
1. Go to Render Dashboard → **hinabangan-nhs** (or staging)
2. Click **Deploy** → **Deploy Latest Commit**
3. Select the **previous successful commit** (green checkmark)
4. Click **Deploy**
5. Wait for deploy to complete (~5 min)

### Option B: Git Revert + Push (Cleaner, ~10 min)
```bash
# Find the commit to revert to
git log --oneline -10

# Revert the bad commit(s)
git revert <bad-commit-sha>
# OR revert a range
git revert <old-good-sha>..HEAD

# Push to trigger redeploy
git push origin main
```

### Option C: Render CLI (If installed)
```bash
render deploy create --service hinabangan-nhs --commit <good-commit-sha>
```

### Database Rollback (If migration broke)
**Neon Branch Reset** (Preferred):
1. Neon Console → **Branches** → Select `main` (or `staging`)
2. Click **Reset Branch** → Choose timestamp before bad migration
3. Confirm (this rewrites DB history - coordinate with team)

**Manual SQL Restore** (Last resort):
```bash
# From backup (if R2 configured)
npm run backup:list
npm run backup:drill  # tests restore to isolated schema
# Then manually restore from R2 or pg_dump
```

---

## 4. Smoke Test Checklist

Run after **every** deployment (staging & prod):

| Test | How | Expected |
|------|-----|----------|
| Health endpoint | `curl https://<url>/api/v1/health` | `{"ok":true,"db":"connected"}` |
| Login | Open URL, sign in as `superadmin` | Dashboard loads |
| API auth | `curl -H "Authorization: Bearer <token>" /api/v1/users` | 200 with user list |
| Static assets | Open DevTools → Network → Check `/assets/` | 200, `cache-control: max-age=31536000` |
| File upload | Upload a test image in any module | File appears, accessible via R2 URL |
| Email (if SMTP) | Trigger "Forgot password" | Email received (check logs if not) |
| Operating hours | Visit outside 06:00-24:00 Manila | 423 response with friendly message |

**If any test fails → ROLLBACK IMMEDIATELY**

---

## 4. Common Issues & Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Deploy stuck at "Build" | `npm ci` fails (lockfile mismatch) | Check CI logs, fix `package-lock.json` |
| Deploy stuck at "Start" | Port binding / health check fail | Check logs: `PORT` env, `/api/v1/health` returns 200 |
| "Database unavailable" | `DATABASE_URL` wrong / Neon asleep | Verify Neon connection string, wake DB |
| Login fails | `JWT_SECRET` mismatch / DB not seeded | Check `SEED_ON_BOOT=1`, verify `JWT_SECRET` |
| Assets 404 | Web build not copied | Check `npm run build` output, `web/dist` exists |
| CORS error | `APP_URL` not set / wrong | Set correct `APP_URL` in Render env |
| Free tier cold start | Service slept >15 min | Wait 30-60s, refresh; upgrade to paid for always-on |
| CI fails at "Dependency audit" | New high/critical advisory | See §4a below |
| **CI red, every job fails in ~2s with no log** | Actions quota exhausted — see §4b | Check billing; no code change fixes this |

### 4b. CI red with "0 steps" and no logs (quota exhaustion)

**Symptom.** `Render Deploy` fails on every push. Each job shows **0 steps**
and the run has no log. Other workflows (Dependabot) still succeed.

**Do not debug the YAML first.** This is not a pipeline bug. Confirm with the
GitHub API:

```
GET /repos/{owner}/{repo}/actions/runs/{id}/jobs
```

- Failing job → `steps: 0`, `runner_name: ""`, `started_at == completed_at`
- Healthy job → `steps: 5+`, `runner_name: "GitHub Actions …"`

An empty `runner_name` means **GitHub never assigned a runner**, so nothing in
the workflow executed. Check `Settings → Billing and licensing → Actions` for
minutes used. A private repo on a personal free account gets 2000 minutes/month
and resets on the 1st. Dependabot's own workflow can keep running after the
quota is gone, which makes this look like a repo-specific fault.

**Cost controls already in place:**
- The quality gate is skipped for Dependabot PRs (`check.if` excludes
  `dependabot[bot]`). Human PRs from this repo still run.
- Dependabot PR limits are 5/5/3 — every PR triggers a full CI run, so caps
  matter on a metered plan.

**History — two bugs found here, both already fixed:**
- `.gitleaks.toml` defined `[allowlist]` twice; TOML forbids redefining a table,
  so the file failed to parse and gitleaks broke the gate. Also the allowlist
  blanket-permitted `*.txt`, which would have masked the seeded `accounts.txt`
  credential dump it exists to catch.
- `render-deploy.yml` was briefly committed as **UTF-16LE** (a PowerShell `>`
  redirect under PS 5.1 writes UTF-16). GitHub cannot parse that, and git stored
  it as a binary blob, so the commit showed `0 insertions, 0 deletions` instead
  of a diff. **Never use PowerShell `>` to write a file that gets committed —
  use the Write tool, `git show ... | Out-File -Encoding utf8`, or Node.**

### 4d. Boot fails on a Neon branch: FK / "already exists" during migrations

**Symptom.** `Exited with status 1` with an error like:

```
foreign key constraint "enrollments_student_id_fkey" cannot be implemented
relation "enrollments_student_id_school_year_term_key" already exists   (42P07)
Fatal boot error — shutting down
```

**Cause.** A Neon branch created with **"Branch schema only"** has every table
but an **empty `schema_migrations`**. The app then replays all 100 migrations on
top of objects that already exist and dies partway.

**Verified against PostgreSQL 16:** all 100 PG migrations apply cleanly to a
genuinely **empty** database (96 tables rebuilt). The migrations are fine — the
branch state is the problem.

**Fix — reset the branch to an empty schema** (destroys that branch's data):

```
cd /opt/render/project/src   # or your repo root on Render's shell
node scripts/reset-db-schema.mjs --dry-run     # preview the tables
node scripts/reset-db-schema.mjs               # interactive, type RESET
```

Then **Deploy latest commit**. The boot path rebuilds the schema from
`database/migrations`, and you restore with:

```
cd server && node scripts/backup.js --restore data/backups/<file> --yes
```

No `--bootstrap`: the deploy already applied the migrations.

> Prevention: when creating a recovery branch, prefer a genuinely empty branch.
> "Branch schema only" plus an empty `schema_migrations` is the exact state that
> strands this.

### 4e. Neon storage-cap recovery

**Symptom.** Render logs end with `Exited with status 1`, a fatal boot error,
or `schema "app" does not exist (masked 53100 disk full error)`, and the
service restart-loops.

**Diagnose from the boot log.** Look for the `[SIZE]` lines:

```
[SIZE] <table> <n>MB                       per-table sizes
[SIZE] top-15 public tables: 1.5MB of 514MB database size
```

Three cases:

| Log evidence | Meaning | Action |
|---|---|---|
| One table is genuinely huge | Real data growth | Prune/retention, or upgrade Neon plan |
| `top-15 … 1.5MB of 514MB` | **Orphaned relfiles from dropped tables.** TRUNCATE/VACUUM cannot recover this | **Rebuild the branch** — see below |
| Size drops after `[TRUNCATE]` | Was regenerable log bloat | Already handled automatically |

**Rebuild an oversized Neon branch (needs Neon console + Render dashboard):**

> Get both full connection strings first and keep them somewhere safe — the
> old ones are your rollback. Replace `<OLD_PG_URL>` / `<NEW_PG_URL>` below and
> keep each string's own `sslmode=` parameter.

0. **Baseline.** The current deploy must be booting (health 200) before you
   start. If it is crash-looping, §4d first.
1. **Back up.**
   - Recommended — the app's own backup (restores data semantics on top of the
     fresh schema; a plain `pg_dump` restores clash with it, see §4d):
     ```
     node scripts/backup.js            # in Render Shell (server/ dir)
     node scripts/backup.js --list
     ```
   - Fallback — `pg_dump`. Run it in a container so the file is written as
     UTF-8, not PowerShell's UTF-16:
     ```
     docker run --rm -v "C:\backups:/out" postgres:16-alpine pg_dump "<OLD_PG_URL>" -f /out/backup.sql
     ```
     (or use Neon → **Dump/Download**).
2. **New branch + wipe it.** Neon console → **Branches → Create branch**. A
   branch **copies data**, so wipe it before the new boot — otherwise every
   migration collides with existing objects (the §4d trap):
   ```
   $env:DATABASE_URL="<NEW_PG_URL>"
   node scripts/reset-db-schema.mjs --dry-run      # eyeball host + DB first
   node scripts/reset-db-schema.mjs --yes          # DESTRUCTIVE, targets NEW only
   ```
3. **Swap + deploy.** Render → **hinabangan-nhs** → **Environment** → set
   `DATABASE_URL = "<NEW_PG_URL>"` → Save → **Create Deploy**. The boot path
   rebuilds the schema from `database/migrations` (verified: all migrations
   apply cleanly to an empty PG 16).
4. **Verify.** Health 200, no `[SIZE]`/`53100` in the boot log,
   `[MAINT] ... below reclaim threshold, nothing to do`.
5. **Restore data** (the app backup from step 1):
   ```
   cd server && node scripts/backup.js --restore data/backups/<file> --yes
   ```
   No `--bootstrap` — the deploy already applied the migrations.
6. **Smoke test** (login, a class register, a grade). Only then delete the old
   branch in Neon.

**Rollback** at any point before step 6: flip `DATABASE_URL` back to
`<OLD_PG_URL>` in Render and deploy. The old branch is untouched until you
delete it.

**What the app now does automatically** (`server/src/db.js`):
- `pruneHighChurn()` on every boot — deletes aged rows from 10 high-churn tables.
- `reclaimSpace()` when near the cap — `VACUUM ANALYZE`, then **TRUNCATE** of
  regenerable tables (csrf/password-reset/refresh/device tokens, access logs,
  chat logs, notifications, job locks, rate limits). TRUNCATE is used rather
  than `VACUUM FULL` because FULL rewrites each table into a new file first and
  therefore needs free space that does not exist at the cap — it fails with
  53100 and reclaims nothing.
- Boot is no longer blocked by this maintenance: on a bloated branch it ran for
  ~10 minutes and made Render time out before the port was bound. It is
  deferred to a background `scheduleStorageMaintenance()` task after the app is
  listening (non-fatal, logs `[MAINT]` lines); a healthy install logs
  `below reclaim threshold, nothing to do`.
- A `53100` during migrations no longer aborts the boot. The server starts so
  reads and the health endpoint keep working, and logs the size. **A storage
  cap is an operational problem; crashing turns it into a full outage.**

Deliberately never truncated: `audit_logs`, `password_audit`,
`security_incidents`, `students`, `grades` — these are RA 10173 records.

### 4a. Dependency audit gate

`npm run audit` (`scripts/audit.mjs`) runs on every push and PR. It **fails the
build** on any high/critical vulnerability, except ones explicitly justified in
its `ALLOWLIST`.

Currently allowlisted (1 entry):

| Advisory | Packages | Why it is not fixed |
|---|---|---|
| GHSA-vfj7-8cjw-p6xm | `braces` (via `@sentry/vite-plugin` → `unplugin` → `chokidar`) | **No upstream fix exists.** The advisory covers `braces <=3.0.3` and 3.0.3 is the newest published version, so there is nothing to upgrade to. It is **build-time only** (runs in `vite build`, never shipped in the runtime image) and the flaw needs attacker-controlled glob patterns, which this repo does not accept from users. |

**Do not run `npm audit fix --force`.** npm suggests two changes that would break
working features:
- downgrade `exceljs` 4.4.0 → 3.4.0 (breaks Excel export)
- jump `@sentry/vite-plugin` 3 → 5 (untested major, and the plugin is imported
  unconditionally in `vite.config.js`, so a bad upgrade breaks *every* build)

**Re-evaluate** when `@sentry/vite-plugin` v5+ is adopted. The `uuid` advisory
(moderate, via `exceljs`) is below the gate threshold and not attacker-reachable
— `exceljs` uses v4 UUIDs, while the advisory affects v3/v5/v6 with a caller-
provided `buf`.

---

## 5. First-Time Production Setup

### 1. Create Neon Database
1. Go to https://neon.tech → New Project → Region: **Singapore**
2. Copy connection string (direct, not pooled)
3. In Render → **hinabangan-nhs** → **Environment** → Set `DATABASE_URL`

### 2. Configure Render Services
1. Render Dashboard → **New** → **Blueprint** → Connect GitHub repo
2. Render reads `render.yaml`, creates both services
3. Set all `sync: false` env vars in each service dashboard

### 3. First Boot & Superadmin
1. First deploy runs migrations + seeds automatically
2. Superadmin password:
   - If `SUPERADMIN_PASSWORD` set: uses that value
   - Else: random password printed in **Render logs** (one-time)
3. Sign in at `https://hinabangan-nhs.onrender.com`
4. **Immediately change password**: Key icon → Change password

### 4. Create Staff Accounts
1. Users module → Add users for: admin, registrar, teachers, etc.
2. Assign roles per DepEd matrix (19 roles available)

### 5. Configure Notifications (Optional)
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- SMS: `SMS_PROVIDER_URL`, `SMS_PROVIDER_TOKEN`, `SMS_SENDER`
- Test: "Forgot password" flow

### 6. Enable Backups (Optional but Recommended)
1. Create Cloudflare R2 bucket
2. Set `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`
3. Backups run daily at 02:00 Manila, retain 5, upload to R2

---

## 6. Scaling & Upgrades

| Need | Action | Cost |
|------|--------|------|
| Always-on (no sleep) | Render paid plan: **Starter** ($7/mo) per service | $14/mo (staging + prod) |
| More CPU/RAM | Render **Standard** ($25/mo) per service | $50/mo |
| Larger DB | Neon **Scale** plan ($19/mo) | $19/mo |
| Custom domain | Add CNAME in Render → Settings → Custom Domains | Free (DNS only) |
| CDN/Edge cache | Cloudflare free tier in front of Render | Free |

---

## 7. Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Primary DevOps | [Name] | [Phone/Slack] |
| Backup DevOps | [Name] | [Phone/Slack] |
| Neon Support | - | https://neon.tech/support |
| Render Support | - | https://render.com/support |

---

## 8. Related Documentation

- `docs/31-cloud-deployment.md` - Full cloud deployment guide
- `docs/32-monitoring-setup.md` - Monitoring & alerting setup
- `docs/19-backup-strategy.md` - Backup & restore procedures
- `docs/20-disaster-recovery.md` - DR plan
- `AGENTS.md` - Development guidelines