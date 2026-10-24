# MeridianEd — Non-Functional Requirements

MeridianEd is a secure, cloud-native, AI-powered, mobile-first school management
ecosystem that centralizes academic, administrative, financial, HR, health,
guidance, research, and operational data for elementary schools, junior/senior
high schools, colleges, universities, school divisions, and regional offices.
This document defines the quality attributes the platform MUST satisfy. Each
requirement is testable at the stated target/metric and graded Must, Should, or
Could. These targets apply to the production target architecture (Next.js 15 +
React 19, Flutter 3, NestJS on Node 22, PostgreSQL 16, GCP) and describe the
contract the MVP must converge toward.

> MeridianEd is a placeholder brand — the name is rebrandable at any time.

## Performance

| ID | Category | Requirement | Target / Metric | Priority |
|---|---|---|---|---|
| NFR-01 | Performance | Core API endpoints (login, dashboard, grades, attendance, billing) MUST respond at the p95 percentile within 300 ms, excluding the caller's network. | p95 < 300 ms | Must |
| NFR-02 | Performance | Write-heavy endpoints (grade entry, scan attendance, payment capture) MUST acknowledge within 1 s at p95. | p95 < 1 s | Must |
| NFR-03 | Performance | Dashboard loads MUST be served from cache where permissible; full aggregation MUST not exceed 2 s at p95. | p95 < 2 s | Must |
| NFR-04 | Performance | The system MUST support 1,000,000 registered users and 100,000 concurrent sessions without degradation. | 1M users / 100k concurrent | Must |
| NFR-05 | Performance | Attendance scanning on Android MUST register a scan in under 1 s locally, including offline queueing. | < 1 s per scan | Must |
| NFR-06 | Performance | Report generation (SF1–SF6 for a single school) MUST complete within 30 s; exports SHOULD be asynchronous with download notification. | ≤ 30 s; async | Must |
| NFR-07 | Performance | Search across a school's learners MUST return results within 300 ms for typed prefixes. | < 300 ms | Should |
| NFR-08 | Performance | Background sync of a daily offline queue (≤ 5,000 records) MUST complete within 5 minutes on a 4G connection. | ≤ 5 min | Should |
| NFR-09 | Performance | Static assets MUST be served via CDN with 90%+ cache hit rate. | ≥ 90% hit rate | Should |

## Availability

| ID | Category | Requirement | Target / Metric | Priority |
|---|---|---|---|---|
| NFR-10 | Availability | The platform MUST be available 99.9% of the time monthly, across multi-zone GCP deployment with no single point of failure. | ≥ 99.9% | Must |
| NFR-11 | Availability | Scheduled maintenance MUST be announced at least 48 hours in advance and MUST NOT exceed 4 hours per quarter. | ≤ 4 h/quarter | Must |
| NFR-12 | Availability | Degraded mode: when the cloud is unreachable, the mobile app MUST remain usable for attendance, grade entry, and reads. | Offline-first | Must |
| NFR-13 | Availability | Database failover MUST complete within 15 minutes without data loss. | RTO ≤ 15 min (DB HA) | Must |
| NFR-14 | Availability | Region-level recovery MUST restore service within 4 hours. | RTO ≤ 4 h | Must |
| NFR-15 | Availability | Cloud SQL/Redis instances MUST be multi-zone (HA) configured; nightly snapshots and continuous WAL archiving MUST run. | RPO ≤ 15 min | Must |

## Scalability

| ID | Category | Requirement | Target / Metric | Priority |
|---|---|---|---|---|
| NFR-16 | Scalability | The platform MUST scale horizontally: stateless API replicas behind load balancing, autoscaling on CPU/concurrency. | Autoscale 2 → 20 replicas | Must |
| NFR-17 | Scalability | Read-heavy workloads MUST be served from Redis cache first (sessions, KPI aggregations, catalogs). | ≥ 70% read cache hit | Must |
| NFR-18 | Scalability | Data model MUST support tenant isolation at scale via tenant-scoped schemas/rows; indexes MUST cover tenant+date queries. | Indexed tenant queries | Must |
| NFR-19 | Scalability | Storage MUST grow elastically to 100 TB of school assets and backups. | ≥ 100 TB | Should |
| NFR-20 | Scalability | Batch jobs (report generation, sync merge, notification dispatch) MUST queue via worker services and MUST NOT block APIs. | Async queues | Must |
| NFR-21 | Scalability | The system MUST scale to 500+ schools per division deployment and 10,000+ schools nationally on shared infrastructure. | 10k schools | Should |

## Security

| ID | Category | Requirement | Target / Metric | Priority |
|---|---|---|---|---|
| NFR-22 | Security | All traffic MUST be TLS 1.2+ in transit; data at rest MUST be encrypted (AES-256) at database, object storage, and backup. | TLS 1.2+ / AES-256 | Must |
| NFR-23 | Security | Secrets MUST be managed via a secrets manager (GCP Secret Manager or equivalent); no secrets in code or logs. | Zero secrets in repo | Must |
| NFR-24 | Security | Authentication MUST follow the JWT policy: 15-minute access token, 14-day rotating refresh token with revocation. | Per policy | Must |
| NFR-25 | Security | Password policy: ≥ 12 chars, complexity, 90-day expiry, 5 failed attempts → 15-minute lockout. | Per policy | Must |
| NFR-26 | Security | RBAC MUST be enforced server-side on every API call; client-side hiding is cosmetic only. | Server-side enforcement | Must |
| NFR-27 | Security | Input validation MUST be applied to all endpoints (OWASP ASVS baseline); SQL injection, XSS, and SSRF protections MUST be present. | OWASP ASVS L1 | Must |
| NFR-28 | Security | The system MUST pass an annual third-party penetration test and quarterly automated vulnerability scans. | 0 critical/high open | Must |
| NFR-29 | Security | Rate limiting MUST protect authentication, SMS/email, and export endpoints. | Per-tenant limits | Must |
| NFR-30 | Security | Security headers (CSP, HSTS, X-Content-Type-Options) MUST be set on all web responses. | Headers present | Must |
| NFR-31 | Security | File uploads MUST be validated by type, size, and scanned; storage buckets MUST be private with signed URLs. | Signed URLs only | Must |

## Privacy (RA 10173 / GDPR-ready)

| ID | Category | Requirement | Target / Metric | Priority |
|---|---|---|---|---|
| NFR-32 | Privacy | Personal data processing MUST comply with RA 10173; lawful basis, consent records, and data inventory MUST be maintained. | DPA-compliant | Must |
| NFR-33 | Privacy | Learner and personnel data MUST be classifiable (general/restricted); restricted data (health, guidance, discipline) MUST be encrypted and access-controlled separately. | Restricted class | Must |
| NFR-34 | Privacy | Data subject rights (access, correction, erasure where lawful) MUST be implementable via self-service and admin workflows. | Rights workflows | Must |
| NFR-35 | Privacy | The system MUST support regionalization/retention policies: data retention limits per record class, auto-expiry for transitory data. | Retention schedules | Should |
| NFR-36 | Privacy | Breach detection and notification: anomalies in access patterns MUST alert; breach notification MUST be possible within 72 hours. | ≤ 72 h notice | Must |
| NFR-37 | Privacy | GDPR-readiness: export in portable format, cross-border transfer controls, and DPA-like contract terms for HEI/international use. | Portable export | Should |
| NFR-38 | Privacy | De-identification for research: research extracts MUST support pseudonymization on demand. | Pseudonymize | Should |

## Reliability

| ID | Category | Requirement | Target / Metric | Priority |
|---|---|---|---|---|
| NFR-39 | Reliability | API error rate MUST be below 0.1% of requests per month, excluding maintenance windows. | < 0.1% | Must |
| NFR-40 | Reliability | The system MUST fail gracefully: circuit breakers, retries with backoff, and idempotent write endpoints. | Idempotent writes | Must |
| NFR-41 | Reliability | Offline sync MUST be crash-safe: partial syncs resume, records are never lost or duplicated (dedupe keys). | 0 lost/duplicate | Must |
| NFR-42 | Reliability | Database transactions MUST be atomic for multi-row operations (grade posting, billing entries). | ACID | Must |
| NFR-43 | Reliability | The system MUST define incident severity levels and an on-call rotation with response SLAs. | S1 ≤ 1 h response | Should |

## Usability and Accessibility

| ID | Category | Requirement | Target / Metric | Priority |
|---|---|---|---|---|
| NFR-44 | Usability | Web and mobile interfaces MUST comply with WCAG 2.2 AA for public-facing content. | WCAG 2.2 AA | Must |
| NFR-45 | Usability | Core tasks (login, attendance, grade entry, payment recording) MUST be completable by a first-time user in ≤ 3 minutes following in-app guidance. | ≤ 3 min | Must |
| NFR-46 | Usability | The UI MUST support Filipino (Tagalog) and English; all user-facing strings MUST be externalized. | i18n 2 locales | Must |
| NFR-47 | Usability | All forms MUST validate inline with clear messages; destructive actions MUST require confirmation. | Inline validation | Must |
| NFR-48 | Usability | The interface MUST render at 320 px minimum width (mobile) and adapt to tablets and Chromebooks. | Responsive | Should |
| NFR-49 | Usability | Typography, color contrast, and touch targets MUST follow Material 3 guidance (see deliverable 10). | Material 3 | Should |

## Maintainability

| ID | Category | Requirement | Target / Metric | Priority |
|---|---|---|---|---|
| NFR-50 | Maintainability | Source MUST follow the documented structure (deliverable 22) with typed contracts shared between frontend and backend. | Shared types | Must |
| NFR-51 | Maintainability | Code review MUST be mandatory via PR with CI checks (lint, type, tests) gating merge. | 100% PR gating | Must |
| NFR-52 | Maintainability | Test coverage MUST be ≥ 80% for business logic and ≥ 60% overall; critical paths (auth, finance, grades) MUST be higher. | 80/60% | Should |
| NFR-53 | Maintainability | Feature flags MUST control new functionality for staged rollout and rollback. | Feature flags | Must |
| NFR-54 | Maintainability | Dependency upgrades MUST be automated (Dependabot/Renovate) with quarterly major-version review. | Automated DSU | Should |
| NFR-55 | Maintainability | Documentation (this package) MUST be updated within the same PR that changes behavior. | Docs in PR | Should |

## Portability

| ID | Category | Requirement | Target / Metric | Priority |
|---|---|---|---|---|
| NFR-56 | Portability | Database access MUST stay within PostgreSQL-standard features so migration to RDS/Azure SQL remains feasible; Cloud SQL is primary. | Standard SQL | Must |
| NFR-57 | Portability | Object storage access MUST use S3-compatible APIs (Cloud Storage primary; GCS ↔ S3 compatible). | S3-compatible | Should |
| NFR-58 | Portability | Mobile clients MUST be installable without Play Store dependency (APK sideload) for schools without store access. | APK install | Should |
| NFR-59 | Portability | The MVP local fallback (node:sqlite) MUST mirror the production schema so a school can run a single-node install if needed. | Schema parity | Should |

## Backup and Recovery

| ID | Category | Requirement | Target / Metric | Priority |
|---|---|---|---|---|
| NFR-60 | Backup | Database MUST have continuous WAL archiving plus nightly snapshots; backups MUST be encrypted and stored in a different zone/region. | RPO ≤ 15 min | Must |
| NFR-61 | Backup | Backup retention MUST be 30 days daily, 12 monthly, and 7 yearly; a restore test MUST run monthly. | Retention + monthly test | Must |
| NFR-62 | Backup | Object storage (uploads, exports, attachments) MUST be versioned with 30-day retention and soft-delete. | Versioned buckets | Must |
| NFR-63 | Backup | Point-in-time recovery MUST restore any table state within the RPO window; recovery drill MUST be documented (deliverable 20). | PITR ≤ RPO | Must |
| NFR-64 | Backup | Database HA failover MUST meet RTO ≤ 15 minutes with zero data loss. | RTO ≤ 15 min | Must |

## Auditability

| ID | Category | Requirement | Target / Metric | Priority |
|---|---|---|---|---|
| NFR-65 | Audit | The audit log MUST be immutable and append-only (write-once storage, no delete/update APIs). | Immutable | Must |
| NFR-66 | Audit | Audit entries MUST record actor, action, object, before/after state, timestamp (UTC), and source IP. | Full metadata | Must |
| NFR-67 | Audit | Audit logs MUST be retained 7 years per DepEd/DPA record-keeping expectations. | 7 years | Must |
| NFR-68 | Audit | Audit log MUST be searchable/filterable by admin and exportable for compliance requests. | Searchable + export | Must |
| NFR-69 | Audit | Financial and grade-change records MUST trigger dual-entry audit plus approval workflow where specified. | Dual audit | Must |
| NFR-70 | Audit | AI-generated insights MUST be logged with model version, inputs, and confidence for explainability. | AI audit | Should |

## Observability

| ID | Category | Requirement | Target / Metric | Priority |
|---|---|---|---|---|
| NFR-71 | Observability | Metrics (Prometheus), logs (Cloud Logging/ELK), and distributed traces MUST cover APIs, workers, sync, and SMS/email providers. | Full telemetry | Must |
| NFR-72 | Observability | Alerts MUST fire on availability dip, error-rate spike, latency p95 breach, and queue backlog. | Alert SLAs | Must |
| NFR-73 | Observability | Dashboards (Grafana) MUST be per-service and per-tenant (school) with privacy-safe aggregation. | Per-tenant dashboards | Should |

## Testing targets

| ID | Category | Requirement | Target / Metric | Priority |
|---|---|---|---|---|
| NFR-74 | Reliability | Load tests MUST be executed quarterly at 2× projected peak; results archived (deliverable 26). | 2× peak | Should |
| NFR-75 | Performance | Latency SLOs MUST be verified in CI with performance regression tests on critical endpoints. | CI perf gate | Should |

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable 4 of 30.*
