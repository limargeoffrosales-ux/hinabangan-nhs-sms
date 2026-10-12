# Setup Checklist — Sentry, R2 Backups, UptimeRobot (do once)

**System:** Hinabangan NHS School Management System (MeridianEd)
**Last Updated:** 2026-10-12

All items here are account/dashboard work that can't be committed to the repo. Each section is independent — do them in any order. Expected total time: ~30 min.

---

## 1. Sentry (error tracking + readable stack traces)

**Sentry dashboard (sentry.io):**
1. Sign up / log in → **Projects → Create Project** → pick *React*, name it `hinabangan-nhs` → copy the **DSN** shown.
2. **Settings → Auth Tokens → Create New Token** with scopes `project:releases`, `org:read`, `project:write` → copy it.
3. Note your **org slug** (top-left dropdown) and **project slug** (= `hinabangan-nhs`).

**Render → hinabangan-nhs (and staging if used) → Environment → add 5 vars → Save → Deploy:**

| Var | Value |
|-----|-------|
| `SENTRY_DSN` | DSN from step 1 (server errors) |
| `VITE_SENTRY_DSN` | same DSN (browser errors) |
| `SENTRY_AUTH_TOKEN` | token from step 2 |
| `SENTRY_ORG` | org slug |
| `SENTRY_PROJECT` | project slug |

**Why it matters:** `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` / `VITE_SENTRY_DSN` are consumed at **build time** (`web/vite.config.js`), so set them BEFORE the deploy that rebuilds the bundle. Without the auth token, source maps aren't uploaded and stack traces stay minified.

**Verify:** open the app → Sentry → the release named like `0.1.0-<gitsha>` should appear. Trigger an error (e.g. hit a bad route) and confirm it lands with an un-minified stack.

---

## 2. Cloudflare R2 (off-server backups)

**Cloudflare dashboard:**
1. **R2 → Create bucket** → name `meridianed-backups`.
2. **R2 → Manage R2 API Tokens → Create API Token** → permission *Object Read & Write* → copy **Access Key ID** + **Secret Access Key** (shown once).
3. Copy your **Account ID** (R2 overview page).
4. **R2 → `meridianed-backups` → Settings → Object Versioning → Enable** (protects backups from accidental overwrite/delete).

**Render → Environment → add 4 vars → Save → Deploy:**

| Var | Value |
|-----|-------|
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | `meridianed-backups` |
| `R2_ACCESS_KEY` | from step 2 |
| `R2_SECRET_KEY` | from step 2 |

`BACKUP_ENABLED=1` / `BACKUP_INTERVAL_HOURS=24` / `BACKUP_RETAIN=5` / `BACKUP_DRILL_ENABLED=1` are already defaults in `render.yaml`.

**Verify:** after deploy, watch Render logs for `backup`/`drill` lines with **PASS**, and confirm a `meridianed-*.json.gz` appears in the R2 bucket under `backups/meridianed/`.

---

## 3. UptimeRobot (outside-in availability alerts)

1. Sign up at uptimerobot.com → **Add New Monitor**.
2. Type **HTTPS**, URL `https://<your-app>.onrender.com/api/v1/health`, interval 5 min, alert by email.
3. Click **Test** → expect `200 OK`.
4. **Expected noise:** Render free tier sleeps after ~15 min idle, so the monitor will alert on expected cold-start wakes (~60s). Treat those alerts as "site is waking, check again" — that's the point of the monitor.

---

## 4. Ops alert recipients (where failure emails go)

`opsAlert()` sends to the **first active `super_admin` account** (`server/src/notify.js`). No code needed — just make the account reachable:
1. Log in as superadmin → **Settings → Accounts** → set the superadmin **email** (and phone if SMS).
2. Email delivery requires SMTP on Render: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (`NOTIFY_EMAIL_ENABLED=1` is default). Without them, notifications stay queued as `sending`.
3. Optional SMS: `NOTIFY_SMS_ENABLED=1` + a provider (`SMS_PROVIDER_URL` + `SMS_PROVIDER_TOKEN`, or `SMS_PROVIDER_URL=textbelt` for one free test message).
4. Verify: in-app **Notifications → Send Test** (POST `/api/v1/notifications/test`) → check the email arrives; then force a `ops_alert` by checking `npm run backup:drill` output or logs.

---

## Not covered here (already working)

- Rate limits, emergency DB prune, cold-start handling, soft delete, audit diffs — all in code, verified by `npm run check`.
- `DATABASE_URL`, `JWT_SECRET`, `SEED_ON_BOOT` — already set on Render.
- Overview docs: `docs/32-operations-runbook.md` (during incident) and `docs/20-disaster-recovery.md` (DR plan).