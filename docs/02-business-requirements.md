# MeridianEd — Business Requirements

MeridianEd is a secure, cloud-native, AI-powered, mobile-first school management
ecosystem that centralizes academic, administrative, financial, HR, health,
guidance, research, and operational data for elementary schools, junior/senior
high schools, colleges, universities, school divisions, and regional offices.
This document defines the business context: who the platform serves, what the
organization must achieve, how success is measured, how it is funded, and what
regulatory and environmental constraints bind it.

> MeridianEd is a placeholder brand — the name is rebrandable at any time.

## Stakeholders

| ID | Stakeholder | Interest | Primary needs |
|---|---|---|---|
| ST-01 | DepEd Central Office | National data integrity, DPA compliance, policy | Clean LIS-aligned data, SF1–SF6 fidelity, auditability |
| ST-02 | Regional offices | Regional roll-ups, budget, programs | Aggregated analytics across divisions, BERF pipeline visibility |
| ST-03 | Division offices (SDOs) | Supervision of schools, reporting deadlines | Real-time school data, verification of SFs, research/QA pipelines |
| ST-04 | Principals / school heads | School operations, accountability | Dashboards, approval workflows, enrollment and attendance visibility |
| ST-05 | Assistant principals / registrars | Scheduling, records, graduations | Sectioning, class records, SF9/SF1 generation, transcripts |
| ST-06 | Teachers | Daily instructional work | Attendance, DLL, assessments, grade entry, report cards, comms |
| ST-07 | Parents | Visibility and payment convenience | Attendance/grade notifications, billing, announcements |
| ST-08 | Students | Academic record ownership and access | Grades, schedule, enrollments, LRN, school life (clinic/guidance) |
| ST-09 | Support staff (nurse, librarian, guidance, cashier, HR, property, ICT) | Domain record-keeping | Module-level workflows, offline capability, audit trail |
| ST-10 | Research officers (school/division/region) | BERF implementation | Study management, survey tooling, data for research |
| ST-11 | Operators / investors | Business viability | SaaS metrics, predictable cloud costs, compliance posture |

## Business goals

| ID | Goal | Alignment |
|---|---|---|
| BG-01 | Become the standard school-management platform for Philippine K-12 by year 3 | Every school rolls up data to division/region without re-encoding |
| BG-02 | Eliminate duplicate data entry (paper → e-Class Record → LIS) | SF1–SF6 generated once, from source records |
| BG-03 | Provide real-time parent visibility and payment channels (GCash/Maya) | Reduce billing disputes and late-payment friction |
| BG-04 | Enable offline-first operation in low-bandwidth schools | Android 9+ devices; sync on reconnect |
| BG-05 | Support the BERF research pipeline from school to region | Research module with survey tooling and repositories |
| BG-06 | Scale beyond K-12 to colleges and universities (level-agnostic) | Same engines, university registrar workflows |
| BG-07 | Remain fully DPA-compliant and audit-ready | Immutable 7-year audit log, role-scoped access |
| BG-08 | Operate at 99.9% availability within GCP at predictable cost | Multi-zone deployment, no single point of failure |

## Success metrics (KPIs)

| ID | KPI | Target | Frequency |
|---|---|---|---|
| KPI-01 | Active schools (paid / pilot) | 10 pilot → 300 by end of year 2 | Quarterly |
| KPI-02 | Daily active users per school | ≥ 60% of staff+teachers; ≥ 20% of parents | Monthly |
| KPI-03 | SF1–SF6 submission time (division deadline to submission) | ≤ 3 working days after quarter close | Per reporting cycle |
| KPI-04 | Data re-entry rate (records typed more than once) | ≤ 5% of records | Quarterly |
| KPI-05 | Attendance recorded within 24 h of class | ≥ 95% of class days | Monthly |
| KPI-06 | Billing collections via platform channels | ≥ 40% of school collections by year 2 | Quarterly |
| KPI-07 | Parent notification open/acknowledgment rate | ≥ 70% ack for SMS/email/push | Monthly |
| KPI-08 | DPA incident count (breaches, unlawful disclosures) | 0 reportable incidents | Annual |
| KPI-09 | Availability | ≥ 99.9% uptime | Monthly |
| KPI-10 | API latency | p95 < 300 ms for core APIs | Monthly |
| KPI-11 | Support resolution | 90% of tickets closed within 3 business days | Monthly |
| KPI-12 | Net retention | ≥ 100% annual net revenue retention | Annual |

## ROI and funding notes

The business model is SaaS with a school-tier fee in PHP, priced per learner or per
school band, plus optional division/regional deployment contracts. Funding sources
include the school's own budget lines, SDO technical assistance funds, and grants;
DepEd orders on ICT utilization and BERF provide programmatic funding hooks.

| Item | Basis |
|---|---|
| Total addressable market | ~47,000 public schools plus private schools and HEIs in the Philippines |
| Revenue model | Per-school annual license, per-learner tier, pilot-to-pay conversion |
| Pilot economics | 10 free pilot schools → conversion rate target ≥ 60% |
| Cost drivers | GCP (Cloud SQL, Cloud Run, storage), SMS/email volume, support staff |
| Cost containment | Offline batching reduces API load; data tiers; reserved instances at scale |
| ROI for a school | Eliminates re-encoding labor, reduces collection days, cuts SMS blast vendor fees, improves BERF throughput |
| ROI for division/region | Real-time roll-ups replace weeks of consolidation and follow-up calls |

## Compliance requirements

| ID | Requirement | Source | Impact |
|---|---|---|---|
| CM-01 | Protect personal data of learners and personnel; consent, breach notification, and DPO liaison obligations | RA 10173 (Data Privacy Act of 2012) | Privacy architecture, retention limits, breach playbook, NPC registration readiness |
| CM-02 | Learner records keyed to LRN; accurate enrolment, assessment, and promotion data | DepEd Learner Information System (LIS) policy | LRN-first SIS; SF1–SF6 fidelity; LIS export formats |
| CM-03 | Classroom assessment and grading aligned to DepEd policy (written work, performance tasks, quarterly) | DO 8, s. 2015 | Grading engine, SF9 report card layout |
| CM-04 | Daily Lesson Log / Daily Lesson Plan preparation | DO 42, s. 2016 | DLL templates and teacher workflow |
| CM-05 | Basic Education Research Fund implementation at school/division/region | DO 3, s. 2018 (BERF) | Research module workflows, fund tracking |
| CM-06 | Governance framework for basic education roles and accountabilities | RA 9155 (Governance of Basic Education Act) | Role model alignment (principal, registrar, etc.) |
| CM-07 | E-Class Record practice continuity | DO 46, s. 2012 | Grade entry mirrors e-Class Record semantics |
| CM-08 | Financial accountability of school funds | DO 16, s. 2015 (School MOOE guidelines) | Finance module budget lines, liquidation views |
| CM-09 | Accessibility of public-facing services | WCAG 2.2 AA (as adopted by procurement policy) | UI/UX standards in deliverable 10/13 |

## Assumptions

| ID | Assumption |
|---|---|
| AS-01 | Schools have at least one internet-connected device and intermittent connectivity; offline-first is a hard requirement |
| AS-02 | LRNs are available for all enrolled learners; missing LRNs are flagged, not blocked |
| AS-03 | School cashiers can reconcile GCash/Maya statements; the platform generates the reconciliation view, not the bank |
| AS-04 | SMS costs are budgeted; push/email is the default channel, SMS is the fallback |
| AS-05 | DepEd reporting formats change; the Reports module is template-driven to absorb revisions |
| AS-06 | Data entry ownership follows existing roles (teacher enters grades, cashier enters payments) |
| AS-07 | Cloud (GCP) is acceptable for public schools; private schools may request on-prem equivalents later |

## Constraints

| ID | Constraint |
|---|---|
| CT-01 | Must operate within Philippine law (RA 10173) and DepEd orders; no storage outside approved jurisdictions without consent |
| CT-02 | Target timezone Asia/Manila (UTC+8); all schedules and reports in local time |
| CT-03 | Primary currency PHP (₱); multi-currency only for HEI international students, later |
| CT-04 | MVP scope is the web portal + Capacitor Android wrapper; full native Flutter client is the production target |
| CT-05 | Per-learner cloud costs must stay within the school-tier price band |
| CT-06 | No per-seat training model: onboarding must be usable from written guides and in-app help |

## Data classes and retention

| Class | Examples | Retention basis |
|---|---|---|
| Learner records | LRN, bio data, enrolment history, SF records | School year lifetime + statutory DepEd retention; archive after graduation |
| Assessment data | Grades, assessments, SF9 | Current + 3 prior school years online; archive thereafter |
| Health and guidance | Clinic visits, case records | Restricted class; retention per RA 10173 proportionality; consent-gated |
| Financial | SOA, receipts, payroll | Statutory financial retention (≥ 10 years for accounting records) |
| Audit log | Immutable action history | 7 years, append-only (per style guide and DPA expectations) |
| Communications | Announcements, SMS logs, delivery status | 2 years, then anonymized aggregates |

Retention schedules are configurable per tenant and enforced by the data
lifecycle job; expiry actions are themselves audited. Research extracts use
pseudonymization by default (NFR-38).

## Release gates (pilot acceptance)

| Gate | Criteria |
|---|---|
| G-01 | Pilot school completes full SY data entry (enrolment, grades, attendance) without re-encoding |
| G-02 | SF1, SF2, SF5, SF6 generated and accepted by the division office in pilot |
| G-03 | 95% of class days have attendance recorded within 24 h (KPI-05) |
| G-04 | Zero reportable DPA incidents across pilot phase (KPI-08) |
| G-05 | 90% of pilot teachers complete gradebook training from in-app guidance alone |
| G-06 | Billing module reconciles ≥ 90% of GCash/Maya payments without manual re-entry |

## Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| RK-01 | DepEd format/policy changes (SF revisions, grading policy) | High | Medium | Template-driven reports, policy flag registry, 90-day compatibility notice |
| RK-02 | Low connectivity blocks sync in pilot schools | High | High | Offline-first queue, delta sync, school-level store-and-forward |
| RK-03 | Data privacy incident | Low | High | DPA architecture, encryption at rest/in transit, breach playbook, staff training |
| RK-04 | Low teacher adoption | Medium | High | In-app guidance, paper-equivalent screens (e-Class Record look-alike), pilot champions |
| RK-05 | SMS cost overruns | Medium | Medium | Push-first, digest batching, per-school SMS budgets |
| RK-06 | Cloud cost growth at 1M-user scale | Medium | Medium | Autoscaling policies, cache-first reads, data lifecycle tiers |
| RK-07 | Competitor entry (national rollouts by incumbents) | Medium | Medium | Depth on offline, finance, and research; school-level support quality |
| RK-08 | Scope creep beyond K-12 into university features prematurely | Medium | Medium | Level-agnostic core, feature flags, roadmap gates (deliverable 30) |
| RK-09 | Key personnel turnover | Medium | Medium | Documentation package (this 30-deliverable set), code ownership rotation |

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable 2 of 30.*
