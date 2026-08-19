# AGENTS.md — Hinabangan NHS School Management System

## Project structure

Monorepo with two packages and a root orchestrator:

```
server/   Express API (CommonJS, Node 22.5+)
web/      React SPA (Vite, ESM, React 19)
database/ migrations/  — paired .sql (PG) + .sqlite.sql files, auto-run on boot
```

Root `package.json` scripts:
- `npm run build` — `cd web && npm ci && npm run build && cd ../server && npm ci`
- `npm start` — `cd server && npm start`

## Dev commands

```bash
# API server (uses built-in SQLite if DATABASE_URL not set)
cd server && npm run dev        # --watch mode, port 4000

# Web portal (Vite, proxies /api -> :4000)
cd web && npm run dev            # port 5173

# Production build + run
npm run build && npm start

# Local PostgreSQL + Redis
docker compose up -d
# Then: $env:DATABASE_URL = "postgresql://meridianed:meridianed-dev@localhost:5432/meridianed"
```

No test suite exists. No lint/typecheck scripts.

## Database

- **Dual-mode**: SQLite locally (`node:sqlite` built-in), PostgreSQL in production (Neon/Render).
- `DATABASE_URL` env var controls dialect: set = PG, unset = SQLite.
- Migrations auto-run on server boot. Files in `database/migrations/` named `NNN-name.sql` (PG) and `NNN-name.sqlite.sql` (SQLite). Both must be created when adding migrations.
- `schema_migrations` table tracks applied files. PG uses batch check; SQLite opens a separate connection per check.

### Critical PG gotchas

These caused real production crashes:

1. **BOOLEAN = integer**: PG returns BOOLEAN as JS `true`/`false`. Never compare with `1`/`0` — use `TRUE`/`FALSE` in SQL, or the `bool()` utility from `db.js`.
2. **`RETURNING *` on PK TEXT**: `app_settings` has `key TEXT PRIMARY KEY`. `RETURNING id` fails because there's no `id` column. Use `RETURNING *`.
3. **Column aliases in GROUP BY/CASE**: PG does NOT resolve SELECT aliases inside `GROUP BY` or `CASE ... WHEN` in ORDER BY. Repeat the full expression:
   ```sql
   -- WRONG in PG:
   SELECT CASE WHEN x >= 90 THEN 'A' END AS band ... GROUP BY band ORDER BY CASE band WHEN ...
   -- CORRECT:
   SELECT CASE WHEN x >= 90 THEN 'A' END AS band ... GROUP BY CASE WHEN x >= 90 THEN 'A' END ORDER BY CASE CASE WHEN x >= 90 THEN 'A' END WHEN ...
   ```
4. **JSONB comes back as JS objects**: `pg` driver auto-parses JSONB columns. Don't call `JSON.parse()` on them — check `typeof` first. Rendering a raw object in React crashes: "Objects are not valid as a React child."
5. **E-string parse errors in migrations**: Use `$$` dollar-quoting instead of single-quote E-strings for PG migration SQL.

## Server architecture

Entry: `server/src/index.js` → boots DB, runs migrations, seeds, mounts Express routes.

Key modules:
- `db.js` — `q()` (single row), `qa()` (all rows), `qr()` (run), `qi()` (runId). Exports `dialect`, `usePg`, `bool()`.
- `auth.js` — JWT sign/verify, `authenticate` middleware, `requireRole()`.
- `utils.js` — `asyncH()` (error wrapper), `audit()`, `page()`, `maskPII()`, `logAccess()`, `safeJsonParse()`.
- `routes/` — one file per domain. Mounted in `index.js` under `/api/v1/`.
- `notify.js` — email (nodemailer/SMTP) + SMS engine, background sweep.
- `schedule.js` — `generateSchedule`, `findConflicts` for auto-program generation.

Route pattern: every route file exports a router with `router.use(authenticate)` at top. Write roles enforced per-endpoint with `requireRole(...)`.

## Web architecture

React 19 + React Router 7 + Vite. Lazy-loaded pages via `React.lazy()`. Auth via `useAuth()` hook from `lib/auth.js`. API client in `lib/api.js` with token refresh.

- `App.jsx` — all routes, `Protected`/`AdminOnly`/`PortalProtected` wrappers.
- `pages/` — one file per page, ~45 pages.
- `components/ui.jsx` — shared primitives: `Badge`, `Modal`, `Empty`, `Spinner`, `ErrorBanner`, `PageHead`.
- `i18n/` — i18next with EN/FIL, LanguageDetector.
- `styles.css` — single CSS file (~1400 lines), CSS custom properties for theming.

### UI gotchas

- `Badge` component accepts `status` prop (not `className`). Passing `className` renders "UNDEFINED".
- `ErrorBanner` expects a string, not an object. Use `e.message` in catch blocks.
- All icon buttons need `aria-label` for accessibility.

## Deployment

- **Render**: Auto-deploys on push to `main`. Build: `npm run build`, Start: `npm start`, Health: `/api/v1/health`.
- GitHub Actions workflow triggers Render deploy hook on push to main.
- Render free tier: ~60s cold start after idle. Service sleeps between requests.
- Env vars needed: `DATABASE_URL`, `JWT_SECRET` (auto-generated), `SEED_ON_BOOT=1`.

## Common patterns

- **Adding a new route**: Create `server/src/routes/X.routes.js`, mount in `index.js`, add page in `web/src/pages/X.jsx`, add route in `web/src/App.jsx`, add nav in `web/src/components/Layout.jsx`.
- **Adding a new migration**: Create both `NNN-name.sql` (PG) and `NNN-name.sqlite.sql` (SQLite) in `database/migrations/`. Auto-applied on next boot.
- **i18n**: Add keys to both `web/src/i18n/en.json` and `fil.json`. Use `t('key')` in components.
- **Server-side filtering**: Use parameterized queries with `?` placeholders — the PG driver converts them to `$1, $2...` automatically via `db.js` params wrapper.

## Removed features (historical — do not re-add)

These features were intentionally removed in commit `5aeb3b8` to reduce bloat:

- **AI Document Generator** (`server/src/ai/`, `AiDocs`, `AiAssistant`, cleanup timer)
- **7-theme picker** (reduced to light/dark toggle only)
- **OneRoster v1.2** (`data-exchange/` module, `DataImportExport` page)
- **Research module** (`research.routes`, `Research`, `PortalResearch`)
- **Password audit trail** (`password-audit.routes`, Users.jsx history modal)
- **Security incidents page** (`security-incidents.routes`, `SecurityIncidents`)
- **Data erasure requests** (erasure endpoints removed from `privacy.routes`)
- **Capacitor Android shell** (config, `android/` directory)
- **Consent forms** (`consent.routes`, `ConsentForms`, `PortalConsent`)
- **Reading & Numeracy** (`ReadingNumeracy` page)

Note: `password_audit` and `security_incidents` **tables are retained** — they are still written to by `auth.routes.js` and `users.routes.js`. Only the routes, UI pages, and i18n keys were removed.

## Login

Superadmin: username `superadmin`, password from `accounts.txt` (or `HNHS-DBPXGeaAP30i` in production).
