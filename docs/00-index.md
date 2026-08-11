# MeridianEd — Deliverables Index

MeridianEd: a cloud-based School Management Ecosystem (web portal + Android app +
central cloud platform) built to the specification in `docs/`. This index maps the
30-deliverable engineering package to the files in this folder.

| # | Deliverable | File |
|---|---|---|
| 1 | Executive Summary | [01-executive-summary.md](01-executive-summary.md) |
| 2 | Business Requirements | [02-business-requirements.md](02-business-requirements.md) |
| 3 | Functional Requirements | [03-functional-requirements.md](03-functional-requirements.md) |
| 4 | Non-Functional Requirements | [04-non-functional-requirements.md](04-non-functional-requirements.md) |
| 5 | System Architecture Diagram | [05-system-architecture.md](05-system-architecture.md) |
| 6 | Cloud Infrastructure Diagram | [06-cloud-infrastructure.md](06-cloud-infrastructure.md) |
| 7 | Database ERD | [07-database-erd.md](07-database-erd.md) |
| 8 | API Documentation | [08-api-documentation.md](08-api-documentation.md) |
| 9 | Database Schema | [09-database-schema.md](09-database-schema.md) + [../database/migrations](../database/migrations) SQL |
| 10 | UI Wireframes | [10-ui-wireframes.md](10-ui-wireframes.md) |
| 11 | Android App Screens | [11-android-app.md](11-android-app.md) |
| 12 | Admin Dashboard | [12-admin-dashboard.md](12-admin-dashboard.md) |
| 13 | Parent Portal | [13-portals.md](13-portals.md) |
| 14 | Teacher Portal | [13-portals.md](13-portals.md) |
| 15 | Student Portal | [13-portals.md](13-portals.md) |
| 16 | User Flow Diagrams | [16-user-flows.md](16-user-flows.md) |
| 17 | Security Architecture | [17-security-architecture.md](17-security-architecture.md) |
| 18 | Deployment Architecture | [18-deployment-architecture.md](18-deployment-architecture.md) |
| 19 | Backup Strategy | [19-backup-strategy.md](19-backup-strategy.md) |
| 20 | Disaster Recovery Plan | [20-disaster-recovery.md](20-disaster-recovery.md) |
| 21 | DevOps Pipeline | [21-devops-pipeline.md](21-devops-pipeline.md) |
| 22 | Source Code Structure | [22-source-structure.md](22-source-structure.md) |
| 23 | Folder Structure | [22-source-structure.md](22-source-structure.md) |
| 24 | API Endpoints | [08-api-documentation.md](08-api-documentation.md) |
| 25 | Database Migration Plan | [25-database-migrations.md](25-database-migrations.md) |
| 26 | Testing Strategy | [26-testing-strategy.md](26-testing-strategy.md) |
| 27 | Scalability Plan | [27-scalability-plan.md](27-scalability-plan.md) |
| 28 | Maintenance Plan | [28-maintenance-plan.md](28-maintenance-plan.md) |
| 29 | Future AI Roadmap | [29-ai-roadmap.md](29-ai-roadmap.md) |
| 30 | Five-Year Product Roadmap | [30-five-year-roadmap.md](30-five-year-roadmap.md) |
| 31 | Cloud Deployment Guide (Render + Neon) | [31-cloud-deployment.md](31-cloud-deployment.md) |

## Package contents

```
school-system/
├── docs/            ← this documentation package (deliverables 1–30)
├── database/        ← SQL migrations (PostgreSQL + SQLite local fallback) and seed data
├── server/          ← runnable MVP backend (Node 22 + Express)
├── web/             ← runnable MVP web portal (React 19 + Vite) — also the Android app shell
├── android/         ← Capacitor Android wrapper for the web build
├── docker-compose.yml
└── README.md
```

## How to read this package

1. Start with the [Executive Summary](01-executive-summary.md), then the
   [System Architecture](05-system-architecture.md).
2. Use the [Requirements](03-functional-requirements.md) as the contract for the MVP.
3. For implementation details, see [API Documentation](08-api-documentation.md) and
   [Database Schema](09-database-schema.md).
4. To run the MVP, follow `../README.md` (root of `school-system/`).

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable index.*
