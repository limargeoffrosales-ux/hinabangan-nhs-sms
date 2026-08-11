# Hinabangan National High School — School Management System

School management system for **Hinabangan National High School, Hinabangan, Samar**
(formerly the MeridianEd project template) — a secure, mobile-first school
management ecosystem that centralizes academic, administrative, and operational
data for senior high school operations.

This repository contains the **full engineering package**: the 30-deliverable
documentation set (in `docs/`) and a **runnable system** (API server + web
portal + Android app shell).

---

## 1. Documentation package (`docs/`)

Start at [docs/00-index.md](docs/00-index.md) — a map of all 30 deliverables:

| Area | Files |
|---|---|
| Product & requirements | 01 Executive Summary · 02 Business · 03 Functional · 04 Non-Functional |
| Architecture & data | 05 System Architecture · 06 Cloud Infra · 07 ERD · 08 API Docs · 09 Schema · 25 Migrations |
| UX | 10 Wireframes · 11 Android App · 12 Admin Dashboard · 13 Portals |
| Security & ops | 16 User Flows · 17 Security · 18 Deployment · 19 Backup · 20 DR · 21 DevOps |
| Structure | 22 Source/Folder Structure · 24 API endpoints (in 08) |
| Quality & strategy | 26 Testing · 27 Scalability · 28 Maintenance · 29 AI Roadmap · 30 Five-Year Roadmap |

Shared conventions live in `docs/.docs-style.md`.

## 2. Run the MVP

Requirements: Node.js 22.5+ (tested on 24). No database install needed — local
dev uses Node's built-in SQLite; production uses PostgreSQL.

### Start the API server

```
cd server
npm install
npm run seed        # optional: demo data (users, students, grades, attendance)
npm start           # http://localhost:4000
```

### Start the web portal

```
cd web
npm install
npm run dev         # http://localhost:5173  (proxies /api -> :4000)
```

Sign in with a demo account (password `MeridianEd2026!`):

| Username | Role |
|---|---|
| `superadmin` | Super Administrator |
| `admin` | School Administrator |
| `registrar` | Registrar |
| `teacher` | Teacher |
| `nurse` / `guidance` / `librarian` / `cashier` | Department roles |
| `parent` / `student` | Portal roles |

### Use PostgreSQL instead of SQLite

```
docker compose up -d        # postgres:16 + redis:7
cd server
$env:DATABASE_URL = "postgresql://meridianed:meridianed-dev@localhost:5432/meridianed"
npm run seed && npm start
```

In production set `DATABASE_URL`, `JWT_SECRET`, `PORT`, and `GRADE_WEIGHTS`.

### Deploy to the cloud (free) — make it reachable from any device

`render.yaml` deploys the API + web portal + managed PostgreSQL to free-tier
**Render + Neon** in one click. Full walkthrough (GitHub upload, blueprint,
database seeding, first sign-in, Android app server address):

```
docs/31-cloud-deployment.md
```

Highlights: one public URL for all devices, automatic HTTPS, data in managed
Postgres (survives redeploys), one-time `npm run seed`, ~1 min cold start on the
free tier after idle.

### Android app

The portal is a Capacitor-ready SPA (`web/capacitor.config.json` is included):

```
cd web
npm run build
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap add android
npx cap sync android
npx cap open android      # then build/run from Android Studio
```

The full Android roadmap (biometrics, NFC/RFID, QR, offline sync, widgets) is in
[docs/11-android-app.md](docs/11-android-app.md).

## 3. MVP scope

| Module | Implemented |
|---|---|
| Auth (JWT + refresh, password policy) | ✅ |
| RBAC (19 DepEd roles, role-guarded routes) | ✅ |
| Students (LRN, guardians, full CRUD) | ✅ |
| Teachers (PRC, positions, CRUD) | ✅ |
| Subjects, Sections (+ roster), Enrollment | ✅ |
| **Teacher Programs (auto-scheduling, G11/G12, conflict-free)** | ✅ |
| Grades — class records w/ DepEd 25/45/30 weights, report cards, GWA | ✅ |
| Attendance (bulk + per-student, 4 statuses) | ✅ |
| Announcements (audience/priority) | ✅ |
| Dashboard (KPIs, charts, trends) | ✅ |
| Audit log (immutable trail, RA 10173) | ✅ |
| Dark/light theme, responsive | ✅ |
| AI features, finance, library, clinic, guidance, property, research, reports | Vision only (docs) |

## 4. API quick reference

Base URL: `/api/v1` — see [docs/08-api-documentation.md](docs/08-api-documentation.md).

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` `/auth/refresh` `/auth/logout` | Sessions |
| GET | `/auth/me` | Current user |
| GET/POST | `/users`, `/students`, `/teachers`, `/subjects`, `/sections`, `/announcements` | CRUD |
| GET/POST | `/enrollments` | Enroll learners |
| GET/POST | `/grades/class` | Class record save/load |
| GET | `/grades/report-card/:studentId` | Report card + GWA |
| GET/POST | `/attendance` `/attendance/bulk` | Daily attendance |
| GET | `/dashboard/summary` `/dashboard/attendance-trend` | Analytics |
| GET | `/audit` `/audit/actions` | Audit trail |
| GET/POST | `/schedule/assignments` | Subject→section assignments |
| POST | `/schedule/generate` | Auto-generate conflict-free programs |
| GET | `/schedule?teacher_id=&section_id=` `/schedule/conflicts` | Programs & conflict report |
| GET | `/health` | Liveness |

## 5. Roadmap

Y1 (2026): MVP + pilot school; Y2: full academic suite, finance/payroll, Play Store
release; Y3: health/guidance/library/property modules, AI assistant v1; Y4: AI
suite, LIS integration, university support; Y5: 1M+ users, regional analytics.
Details: [docs/30-five-year-roadmap.md](docs/30-five-year-roadmap.md).

---
*MeridianEd — Cloud-Based School Management Ecosystem.*
