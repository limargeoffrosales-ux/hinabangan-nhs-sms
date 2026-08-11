# Source Code and Folder Structure

MeridianEd is a secure, cloud-native, AI-powered, mobile-first school management
ecosystem that centralizes academic, administrative, financial, HR, health,
guidance, research, and operational data for elementary schools, junior/senior
high schools, colleges, universities, school divisions, and regional offices.
This document combines Deliverables 22 (Source Code Structure) and 23 (Folder
Structure): the monorepo layout for the full product, the current MVP layout in
this repository, and the dependency-direction and naming rules that keep both
consistent. MeridianEd is a placeholder brand — the name is rebrandable at any
time.

> **MVP note**: this repo currently contains the MVP skeleton (server, web,
> database, docs); the production monorepo structure in Section 1 is the target
> the MVP will migrate into.

## 1. Full product monorepo (target)

Single repository, npm workspaces at the root. One codebase for web, API, and
shared packages; Flutter mobile lives in `apps/mobile` with its own toolchain.

```
school-system/
├── apps/
│   ├── web/                  # Next.js 15 + React 19 + TS portal (SSR, dashboards)
│   ├── mobile/               # Flutter 3 (Android/iOS/tablet/Chromebook)
│   ├── mobile-web/           # Capacitor 8 wrapper (reuses web build for kiosks)
│   └── api/                  # NestJS + Node 22 + TS modular monolith
│       ├── src/modules/      # one folder per NestJS module (IAM, SIS, Academic...)
│       ├── src/common/       # guards, interceptors, DTOs, decorators
│       └── src/config/       # env validation, bootstrap
├── packages/
│   ├── shared-types/         # TS interfaces + Zod schemas (API contract)
│   ├── sdk/                  # typed REST client used by web and tools
│   ├── ui/                   # shared React components (tables, forms, charts)
│   └── config/               # eslint/tsconfig/prettier presets
├── infra/
│   ├── terraform/            # GCP IaC: environments/, modules/, backends/
│   ├── k8s/                  # manifests: api, workers, ai-server
│   └── docker/               # Dockerfiles + compose overlays
├── database/
│   ├── migrations/           # NNNN_description.sql (see Deliverable 25)
│   └── seed/                 # reference data (regions, divisions, MELCs)
├── ai/                       # Python AI server (RAG, analytics) — isolated repo later
├── docs/                     # this documentation package (Deliverables 1–30)
├── .github/workflows/        # CI/CD (Deliverable 21)
└── README.md
```

## 2. Current repo MVP layout

The runnable MVP (as in `../README.md` and `docs/00-index.md`) uses this
layout:

```
school-system/
├── server/                   # Node 22 + Express API
│   └── src/
│       ├── index.js          # bootstrap, middleware wiring, listen
│       ├── db.js             # pg pool (node:sqlite fallback), migration runner
│       ├── middleware/       # Express middleware
│       │   ├── auth.js       # JWT verify + role guard factory
│       │   ├── validate.js   # request validation helpers
│       │   └── error.js      # error envelope (Deliverable 8 format)
│       └── routes/           # one file per resource group
│           ├── auth.js       # login, refresh, me, change-password
│           ├── users.js      # users + roles
│           ├── students.js   # CRUD + LRN search + import
│           ├── teachers.js
│           ├── subjects.js
│           ├── sections.js
│           ├── enrollments.js
│           ├── attendance.js
│           ├── grades.js     # batch entry, submit
│           ├── announcements.js
│           ├── dashboard.js  # overview + school stats
│           └── audit.js      # audit trail reads
├── web/                      # React 19 + Vite portal
│   ├── public/               # static assets
│   └── src/
│       ├── main.tsx          # entry, router
│       ├── App.tsx           # layout + route table
│       ├── pages/            # one file per page
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── Students.tsx
│       │   ├── Grades.tsx
│       │   ├── Attendance.tsx
│       │   └── Announcements.tsx
│       ├── components/       # reusable UI (DataTable, FormField, StatusBadge)
│       └── lib/              # client helpers
│           ├── api.ts        # fetch wrapper + pagination envelope parsing
│           ├── auth.ts       # token storage, refresh logic
│           └── format.ts     # date/LRN/PHP formatting
├── android/                  # Capacitor 8 Android wrapper around web build
├── database/
│   ├── migrations/           # 0001_*.sql ... (PostgreSQL + SQLite dialect)
│   └── seed/                 # seed SQL (admin user, sample school)
├── docs/                     # this documentation package
└── docker-compose.yml        # local: postgres + server + web
```

## 3. Dependency direction rules

| Rule | Direction |
|---|---|
| Apps depend on packages | `apps/* → packages/*` only; packages MUST NOT import apps |
| Packages | `shared-types` has zero imports; `sdk` imports `shared-types`; `ui` imports both |
| Mobile | Flutter app consumes the API via `packages/sdk` contracts over REST; no JS sharing |
| API and database | API runs migrations at deploy time only; no runtime coupling to migration files |
| Infra | `infra/*` references image names and env names; never imports application code |
| AI server | Reads DB snapshots and object storage; writes via API or `ai_logs` tables |
| Docs | `docs/*` references source paths; source never depends on docs |

Cross-module calls inside the NestJS API go through module services or domain
events (Pub/Sub), never raw imports across module boundaries, preserving the
extraction path described in Deliverable 5.

## 4. Naming conventions

| Artifact | Convention | Example |
|---|---|---|
| NestJS modules | PascalCase folder | `src/modules/Academic/` |
| NestJS/TS files | kebab-case | `grades.service.ts`, `grades.controller.ts` |
| Express MVP routes | kebab-case | `routes/students.js` |
| React pages/components | PascalCase | `pages/Grades.tsx`, `components/DataTable.tsx` |
| Web lib/helpers | kebab-case | `lib/api.ts` |
| SQL migrations | `NNNN_description.sql` | `0007_create_grades.sql` |
| Flutter files | snake_case | `attendance_screen.dart` |
| Terraform | snake_case | `modules/cloud_sql/main.tf` |
| Environment variables | SCREAMING_SNAKE | `DATABASE_URL`, `JWT_SECRET` |
| Routes/paths | REST plural nouns, kebab-case | `GET /api/v1/students` |
| DB objects | snake_case, singular | `student_guardians`, `attendance` |

## 5. Module map (target → MVP)

| Target (NestJS) | MVP equivalent (Express) |
|---|---|
| IAM, SIS, Academic, Attendance, Communication, Audit | `server/src/routes/*` |
| DTO validation + guards | `server/src/middleware/` |
| Shared UI kit (`packages/ui`) | `web/src/components/` |
| Pages per module | `web/src/pages/` |
| SDK client | `web/src/lib/api.ts` |
| Migrations | `database/migrations/` |

This mapping means every MVP file has a defined home in the target monorepo;
no structural redesign is required to migrate.

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable 22 of 30.*
