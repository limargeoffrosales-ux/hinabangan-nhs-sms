# MeridianEd — Executive Summary

MeridianEd is a secure, cloud-native, AI-powered, mobile-first school management
ecosystem that centralizes academic, administrative, financial, HR, health, guidance,
research, and operational data for elementary schools, junior/senior high schools,
colleges, universities, school divisions, and regional offices. This document is the
vision statement for the platform and the entry point to the full 30-deliverable
engineering package.

> MeridianEd is a placeholder brand — the name is rebrandable at any time.
> Codename used internally: **MSP** (Meridian School Platform).

## The vision

MeridianEd's vision is a single connected platform where every learner in the
Philippine basic education system — from Kindergarten to university — has one
continuous digital record (keyed on the 12-digit LRN, `XXXXXXXXXXXX`) that follows
them across schools, divisions, and regions, without re-registration or duplicated
data entry.

One system of record replaces the fragmented landscape of paper School Forms
(SF1–SF6), standalone Excel grade sheets, manual GCash/Maya reconciliation,
SMS blast services, and disconnected barangay- or school-level databases. Any
authorized stakeholder — a principal approving a promotion, a nurse logging an
immunization, a parent checking attendance, a division analyst preparing BERF
research — works from the same live data.

The platform is level-agnostic by design: the same SIS, finance, and reporting
engines that serve a DepEd K-12 school serve colleges and universities, with
role-based scoping (region → division → school → section) as the only boundary.

## The problem statement

Philippine schools operate on paper and point solutions. Class records are typed
twice (e-Class Record and the LIS upload), attendance is taken on paper and encoded
months later, billing is reconciled manually against GCash/Maya statements, and
guidance, clinic, and research offices each keep their own silos. The result is
duplicated effort, late and error-prone SF1–SF6 reporting, slow dispute resolution,
and no real-time visibility for parents, principals, or division offices.

Connectivity makes this worse: schools in low-bandwidth areas cannot depend on
always-on web apps, so any solution must work offline on Android 9+ devices and
sync when connectivity returns. Security raises the stakes: RA 10173 (Data Privacy
Act) treats learner and personnel records as personal data, yet most current
workflows exchange them through email, USB drives, and messaging apps.

MeridianEd's thesis is that these problems are structural, not technical
incompetence: the market lacks a purpose-built, offline-first, DPA-compliant
ecosystem priced for Philippine schools. MeridianEd is that missing layer.

## What MeridianEd replaces

MeridianEd does not add a new tool; it replaces an entire working stack. The table
below maps the current de facto toolchain to the MeridianEd module that supersedes it.

| Current practice | Replaced by |
|---|---|
| Paper SF1–SF6, e-Class Records, LIS re-encoding | SIS + Reports (SF1–SF6 auto-generated) |
| Paper class records, manual ranking, late report cards (SF9) | Academic Management: assessments, grades, SF9 on demand |
| Paper attendance sheets encoded months later | Attendance: QR/RFID/NFC/face/GPS, real-time, offline-capable |
| Manual billing, GCash/Maya statement reconciliation | Finance: auto-generated SOA, payment matching, receipts |
| Paper payroll, manual COE requests | HR/payroll module, digital COE requests |
| Separate SMS blast vendors, FB group announcements | Communication: SMS/email/push with delivery receipts |
| Standalone Excel/FileMaker guidance, clinic, library logs | Guidance, Clinic, Library modules on one database |
| Disconnected property, research (BERF) spreadsheets | Property Management, Research module |
| Nothing — schools have no analytics | Dashboard, AI insights, division/region analytics |

## Key capabilities

The platform is organized into core modules; every module shares the same RBAC,
audit trail, and offline-first sync fabric.

| Module | Capability |
|---|---|
| Academic | Curriculum, subjects, sections, scheduling, DLL/lesson plans, assessments, grading (transmuted DepEd scale), report cards (SF9), promotion/graduation, SHS tracks (Academic, TVL, Sports, Arts & Design), Phil-IRI, ARAL, RMA assessments |
| Administration | SIS with LRN, enrolment, sections, adviser assignment, SF1–SF6 reporting, division/region roll-up, university registrar workflows |
| Finance | School billing, payment channels (GCash, Maya, bank), receipts, accounting, payroll, NC II/TESDA fee windows, scholarship/discount schemes |
| HR | Teacher Management, hiring, contracts, attendance, leave, professional development, performance |
| Health | Clinic: consultations, immunizations, Phil-IRI referral data, medicine inventory, physical exam records |
| Guidance | Case records, referrals, interventions, parent conferences, DPA-safe sharing |
| Research | BERF workflows, survey tools, study repository, ethics review flags, division research office pipeline |
| AI | Attendance anomalies, grade prediction, learning-risk flags, parent message drafts, admin copilot, OCR of legacy forms |
| Communication | SMS/email/push notifications, per-role announcement targeting, delivery receipts |
| Mobile | Flutter app for Android 9+, tablets, Chromebooks; offline sync, biometric login, QR attendance scanning, widgets |

## Why it is world-class

MeridianEd is world-class because it is engineered around the constraints other
products ignore: intermittent connectivity, mixed-device classrooms, DPA
compliance, and the full DepEd reporting calendar. The offline-first sync engine
and 99.9% availability target (RPO ≤ 15 min, RTO ≤ 4 h) are production SLOs, not
marketing copy. The target architecture — Next.js 15 + React 19 web, Flutter 3
mobile, NestJS on Node 22, PostgreSQL 16 on Cloud SQL, Keycloak SSO, all on GCP —
is a modern, standards-based stack that also runs at MVP scale (Express +
PostgreSQL with `node:sqlite` fallback, React 19 + Vite, Capacitor 8 Android).

Every record, action, and export is audited immutably for 7 years. Access is
role-scoped end to end (super_admin → region_admin → division_admin → school_admin
→ principal → teacher → student/parent), so a school sees only its own learners,
and a region sees only its divisions. That is not a feature list; it is the
contract that makes DepEd adoption defensible under RA 10173.

## What this package contains

This documentation package is the full engineering blueprint for MeridianEd —
30 deliverables spanning business, requirements, architecture, API, database,
UX, security, operations, and roadmap.

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
| 9 | Database Schema | [09-database-schema.md](09-database-schema.md) + `database/migrations` SQL |
| 10 | UI Wireframes | [10-ui-wireframes.md](10-ui-wireframes.md) |
| 11 | Android App Screens | [11-android-app.md](11-android-app.md) |
| 12 | Admin Dashboard | [12-admin-dashboard.md](12-admin-dashboard.md) |
| 13–15 | Parent, Teacher, Student Portals | [13-portals.md](13-portals.md) |
| 16 | User Flow Diagrams | [16-user-flows.md](16-user-flows.md) |
| 17 | Security Architecture | [17-security-architecture.md](17-security-architecture.md) |
| 18 | Deployment Architecture | [18-deployment-architecture.md](18-deployment-architecture.md) |
| 19 | Backup Strategy | [19-backup-strategy.md](19-backup-strategy.md) |
| 20 | Disaster Recovery Plan | [20-disaster-recovery.md](20-disaster-recovery.md) |
| 21 | DevOps Pipeline | [21-devops-pipeline.md](21-devops-pipeline.md) |
| 22–23 | Source Code / Folder Structure | [22-source-structure.md](22-source-structure.md) |
| 24 | API Endpoints | [08-api-documentation.md](08-api-documentation.md) |
| 25 | Database Migration Plan | [25-database-migrations.md](25-database-migrations.md) |
| 26 | Testing Strategy | [26-testing-strategy.md](26-testing-strategy.md) |
| 27 | Scalability Plan | [27-scalability-plan.md](27-scalability-plan.md) |
| 28 | Maintenance Plan | [28-maintenance-plan.md](28-maintenance-plan.md) |
| 29 | Future AI Roadmap | [29-ai-roadmap.md](29-ai-roadmap.md) |
| 30 | Five-Year Product Roadmap | [30-five-year-roadmap.md](30-five-year-roadmap.md) |

How to read the package: start here, then [02 Business Requirements](02-business-requirements.md)
for the business case and [03 Functional Requirements](03-functional-requirements.md)
for the contract. Architecture readers continue with deliverables 5–9; UX readers
jump to deliverables 10–16; operations readers to 17–28.

## Key operating parameters

| Parameter | Value |
|---|---|
| Primary market | Philippine K-12 (DepEd); scales to colleges and universities |
| Currency / timezone | PHP (₱) / Asia/Manila (UTC+8) |
| Primary cloud | Google Cloud Platform (GCP); AWS/Azure equivalents noted where natural |
| Availability | 99.9% multi-zone |
| Backup / recovery | RPO ≤ 15 min, RTO ≤ 4 h (region), RTO ≤ 15 min (database HA) |
| Sessions | JWT 15 min + refresh 14 days, rotation and revocation |
| Audit log | Immutable, append-only, 7 years |
| User scale | Up to 1,000,000 registered users |
| Target stack | Next.js 15 + React 19 · Flutter 3 · NestJS on Node 22 · PostgreSQL 16 · Keycloak · GCP |
| MVP stack | Express (Node 22) + PostgreSQL (`node:sqlite` fallback) · React 19 + Vite · Capacitor 8 Android |

These numbers are repeated in every deliverable that depends on them; any future
change must be coordinated through this summary and the style guide.

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable 1 of 30.*
