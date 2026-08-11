# MeridianEd — Functional Requirements

MeridianEd is a secure, cloud-native, AI-powered, mobile-first school management
ecosystem that centralizes academic, administrative, financial, HR, health,
guidance, research, and operational data for elementary schools, junior/senior
high schools, colleges, universities, school divisions, and regional offices.
This document is the functional contract. Every requirement is written with
RFC 2119 keywords (MUST, SHOULD, MAY) and graded by priority: Must (MUST),
Should (SHOULD), Could (MAY). Where this document and a UI/wireframe conflict,
this document governs.

> MeridianEd is a placeholder brand — the name is rebrandable at any time.

## 1. Authentication and User Management

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-01 | The system MUST authenticate users via Keycloak (OAuth2/OIDC) with JWT access tokens (15 min) and rotating refresh tokens (14 days). | Must | Auth |
| FR-02 | Passwords MUST meet policy: ≥ 12 characters, complexity, 90-day expiry, 5 failed attempts → 15-minute lockout. | Must | Auth |
| FR-03 | The system MUST support single sign-on via Google, Microsoft, and DepEd credentials where the school provides them. | Should | Auth |
| FR-04 | The system SHOULD support multi-factor authentication (TOTP, SMS OTP) for super_admin, region_admin, and division_admin accounts. | Should | Auth |
| FR-05 | The system MUST support password reset via registered email and/or SMS with one-time codes. | Must | Auth |
| FR-06 | The system MUST support session revocation (force logout) of any user by an administrator. | Must | Auth |
| FR-07 | The system MUST provide self-service profile management (name, photo, contact details, password change). | Must | Auth |
| FR-08 | The system MUST lock an account after 5 consecutive failed attempts and MUST show the remaining attempts. | Must | Auth |
| FR-09 | The system MUST record every authentication event (success, failure, lockout, revocation) in the audit log. | Must | Auth |
| FR-10 | The system MUST support biometric unlock (fingerprint/face) on Android via the platform's key store; biometrics MUST NOT replace server-side MFA for sensitive roles. | Must | Auth |
| FR-11 | The system MUST support LRN-based account linking for students (username generation and guardian association). | Must | Auth |

## 2. RBAC and Permissions

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-12 | The system MUST implement the role model: super_admin, region_admin, division_admin, school_admin, principal, assistant_principal, registrar, teacher, guidance, nurse, librarian, cashier, accounting, hr, property_custodian, ict, security, student, parent. | Must | RBAC |
| FR-13 | Access MUST be scoped to the user's tree node (region → division → school → section) via row-level tenant scoping; a school account MUST NOT read another school's records. | Must | RBAC |
| FR-14 | The system MUST allow an admin to grant or revoke roles and school assignments without changing the account. | Must | RBAC |
| FR-15 | The system MUST support role inheritance (e.g., a division_admin MAY see all schools in the division; school_admin MAY see all sections in the school). | Must | RBAC |
| FR-16 | The system MUST prevent a teacher from editing grades for sections not assigned to them. | Must | RBAC |
| FR-17 | The system SHOULD support custom roles and permission sets for universities (registrar, dean, department chair). | Should | RBAC |
| FR-18 | The system MUST allow limited data-sharing grants (e.g., nurse shares a clinic summary with guidance) via explicit consent records. | Should | RBAC |
| FR-19 | The system MUST reject unauthorized API calls with HTTP 403 and MUST audit the attempt. | Must | RBAC |

## 3. Dashboard

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-20 | The system MUST provide a role-aware dashboard showing KPIs relevant to the user's tree node and role. | Must | Dashboard |
| FR-21 | The dashboard MUST show at minimum: student population, attendance rate, enrollment trend, and latest announcements (MVP scope). | Must | Dashboard |
| FR-22 | The dashboard SHOULD include KPI cards, charts, heatmaps, and AI insight panels per role (see deliverable 12). | Should | Dashboard |
| FR-23 | The dashboard MUST deep-link every KPI to the underlying list of records. | Must | Dashboard |
| FR-24 | The dashboard MUST display a sync status indicator when used offline on mobile. | Must | Dashboard |
| FR-25 | The dashboard SHOULD show a task center (approvals, pending SF submissions, overdue actions) personalized per user. | Should | Dashboard |

## 4. Student Information System (SIS)

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-26 | The system MUST store learner records keyed by LRN (`XXXXXXXXXXXX`), name, birthdate, sex, religion, address, barangay, guardian/parent details. | Must | SIS |
| FR-27 | The system MUST support enrolment workflows: pre-enrolment, enrolment, transferring in/out, dropping, returning, and graduation. | Must | SIS |
| FR-28 | Enrolment data MUST include grade/year level, section, school year, semester (for SHS/college), and SHS track (Academic, TVL, Sports, Arts & Design). | Must | SIS |
| FR-29 | The system MUST maintain a learner's school history (schools attended, school years, sections, advisers). | Must | SIS |
| FR-30 | The system MUST generate and print SF1 (class list) per section per school year from live data. | Must | SIS |
| FR-31 | The system MUST flag duplicate learners by LRN or name/birthdate matching for merging. | Must | SIS |
| FR-32 | The system MUST support the 12-digit LRN format validation and MUST accept "pending LRN" placeholder with later correction. | Must | SIS |
| FR-33 | The system SHOULD support guardian accounts linked to one or more learners, with consent on record. | Should | SIS |
| FR-34 | The system MUST support student photos and ID generation (school ID, temporary ID). | Should | SIS |
| FR-35 | The system MUST support special education (SPED), inclusive education, and indigent-learner flags used by reports. | Should | SIS |
| FR-36 | The system MUST support curriculum levels: Kinder, elementary, JHS, SHS, and higher education programs with corresponding structures. | Must | SIS |
| FR-37 | The system SHOULD support university features: program/degree, college/department, course catalog, terms, and registrar-controlled transcript processing. | Should | SIS |
| FR-38 | The system MUST support historical archive queries (e.g., SF9 reprint from any past school year). | Should | SIS |

## 5. Teacher Management

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-39 | The system MUST maintain teacher records: civil service/employee number, qualifications, license, subject specializations, employment type, station. | Must | HR |
| FR-40 | The system MUST track teacher assignments (section advisers, subject load, class schedules per term). | Must | HR |
| FR-41 | The system SHOULD track attendance and leave (vacation, sick, maternity/paternity, study) with approvers. | Should | HR |
| FR-42 | The system SHOULD track professional development hours, trainings, and certifications (e.g., NC II/TESDA, seminar certificates). | Should | HR |
| FR-43 | The system SHOULD support performance review records and classroom observation forms. | Should | HR |
| FR-44 | The system MAY support hiring workflow: posting, applicants, interview notes, and onboarding checklists. | Could | HR |
| FR-45 | The system MUST prevent deletion of a teacher with historical records; records MAY be marked inactive instead. | Must | HR |

## 6. Academic Management

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-46 | The system MUST manage the curriculum tree: learning areas/subjects, grade-level standards, and units/lessons aligned to K-12 and HEI curricula. | Must | Academic |
| FR-47 | The system MUST manage sections: creation, capacity, adviser assignment, and learner placement rules. | Must | Academic |
| FR-48 | The system MUST support automatic sectioning suggestions (balance by gender, repetition of grade, preferences) and manual override. | Should | Academic |
| FR-49 | The system MUST support subject offerings per school year/term and teacher assignment to subject sections. | Must | Academic |
| FR-50 | The system MUST support class scheduling (time slots, rooms, sections, teachers) with conflict detection for teachers, rooms, and sections. | Must | Academic |
| FR-51 | The system SHOULD provide a visual schedule builder with drag-and-drop and conflict warnings. | Should | Academic |
| FR-52 | The system MUST provide DLL (Daily Lesson Log) templates aligned to DO 42, s. 2016, with school-approved format defaults. | Must | Academic |
| FR-53 | Teachers MUST be able to create, copy, and submit lesson plans/DLLs; reviewers SHOULD be able to approve with comments. | Must | Academic |
| FR-54 | The system MUST support assessment types: written work, performance tasks, quarterly assessments, and formative assessments. | Must | Academic |
| FR-55 | The system MUST compute grades with the DepEd transmutation table (initial grade to transmuted grade) as configurable templates. | Must | Academic |
| FR-56 | The system MUST support grade entry with validation (score ≤ max score, within assessment window) and MUST audit every edit. | Must | Academic |
| FR-57 | The system MUST compute final grades, ranks, honors (With Honors/Highest Honors), and general average per section. | Must | Academic |
| FR-58 | The system MUST generate SF9 (report card) per learner with DepEd layout, parent signature blocks, and reprint capability. | Must | Academic |
| FR-59 | The system MUST support remedial, promotion/retention decisions with remarks, and MUST require principal/registrar approval for finalized grades. | Must | Academic |
| FR-60 | The system SHOULD support SHS-specific requirements: track core/applied/specialized subjects, work immersion, and NC II/TESDA certification links. | Should | Academic |
| FR-61 | The system SHOULD support PHIL-IRI, ARAL, and RMA assessment data capture per learner for remedial planning. | Should | Academic |
| FR-62 | The system SHOULD support HEI grading scales (e.g., 1.0–5.0, percent) selectable per program. | Should | Academic |
| FR-63 | The system MUST freeze final grades at reporting period close; unfreezing MUST require a school_admin action and an audit entry. | Must | Academic |
| FR-64 | The system MUST generate SF5 (report on promotion/graduation) and SF6 (summary of enrollment/graduation) from the same finalized data. | Must | Academic |

## 7. Attendance

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-65 | The system MUST record daily attendance per learner per class/section with status (present, late, absent, excused, unexcused, suspended). | Must | Attendance |
| FR-66 | The system MUST support scanning-based attendance: QR (student ID), RFID/NFC cards, and camera/face capture. | Must | Attendance |
| FR-67 | The system SHOULD support GPS/location-based attendance for off-campus activities, work immersion, and events. | Should | Attendance |
| FR-68 | Scanning MUST work offline on Android and MUST queue records for sync (order-preserving, deduplicated). | Must | Attendance |
| FR-69 | The system MUST allow manual correction of attendance by teachers, with the original and correction both audited. | Must | Attendance |
| FR-70 | The system MUST compute attendance summaries: daily, weekly, per subject, per grading period, and school-wide rates. | Must | Attendance |
| FR-71 | The system MUST notify parents via configured channels when a learner is marked absent (tunable threshold, default end-of-day). | Should | Attendance |
| FR-72 | The system SHOULD detect duplicate scans (same learner within a configurable window) and flag anomalies. | Should | Attendance |
| FR-73 | The system MUST support faculty and staff attendance tracking for payroll linkage. | Must | Attendance |
| FR-74 | Attendance data MUST roll up to SF2 (daily attendance report) and SF5/SF6 aggregates. | Must | Attendance |

## 8. Finance

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-75 | The system MUST manage school billing: fee items, amounts (PHP), discounts, scholarships, installment schedules, and per-school-year ledgers. | Must | Finance |
| FR-76 | The system MUST generate per-learner statements of account (SOA) with running balances and past-due flags. | Must | Finance |
| FR-77 | The system MUST record payments via channels: cash, GCash, Maya, bank transfer/over-the-counter, and card. | Must | Finance |
| FR-78 | The system MUST support GCash/Maya reference-number matching to auto-reconcile payments (manual confirmation for ambiguous matches). | Must | Finance |
| FR-79 | The system MUST issue official receipts (OR) and acknowledgement receipts with running OR numbers per school. | Must | Finance |
| FR-80 | The system MUST support refunds, write-offs, and adjustments, all requiring approval and audit. | Must | Finance |
| FR-81 | The system SHOULD support payment links/invoices sent to parents via SMS/email with QR payment (GCash/Maya). | Should | Finance |
| FR-82 | The system MUST provide daily collection summaries and a collections dashboard for the cashier and school head. | Must | Finance |
| FR-83 | The system MUST manage scholarship/discount schemes (DepEd voucher, TES, academic, indigent) with expiry and review workflows. | Must | Finance |
| FR-84 | The system MUST support MOOE budget lines and expenditure recording per CM-08. | Should | Finance |
| FR-85 | The system MUST support payroll for staff: salary rates, deductions, allowances, net pay computation, payslip generation. | Must | Finance |
| FR-86 | Payroll MUST integrate with attendance/leave data for deduction computation where configured. | Should | Finance |
| FR-87 | The system SHOULD support accounting views (journal entries, AR/AP, aging) exportable for external accountants. | Should | Finance |
| FR-88 | The system MUST restrict finance data to cashier, accounting, and authorized admins via RBAC. | Must | Finance |
| FR-89 | The system SHOULD support fee windows for SHS tracks and NC II/TESDA assessments. | Should | Finance |
| FR-90 | The system MUST retain financial records for statutory periods and MUST support year-end closing. | Must | Finance |

## 9. Library

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-91 | The system MUST maintain a library catalog (title, author, ISBN, subject area, copies, location) with import from CSV/MARC-adjacent formats. | Must | Library |
| FR-92 | The system MUST support borrowing/returning with due dates, renewals, holds, and overdue tracking. | Must | Library |
| FR-93 | The system MUST notify patrons of due/overdue items via configured channels. | Should | Library |
| FR-94 | The system MUST support barcode/QR scanning for check-in/check-out on Android. | Must | Library |
| FR-95 | The system SHOULD track damages, lost items, and fines/payments tied to the finance module. | Should | Library |
| FR-96 | The system SHOULD support acquisition workflows (request, order, receive, catalog) and weeding. | Should | Library |
| FR-97 | The system MUST provide circulation statistics (borrows, returns, top titles, per-grade usage). | Must | Library |
| FR-98 | The system MAY support e-resources metadata (links, digital copies) with DRM-agnostic records. | Could | Library |

## 10. Clinic

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-99 | The system MUST maintain learner health records: allergies, conditions, medicines, and emergency contacts. | Must | Clinic |
| FR-100 | The system MUST record consultations/visits with symptoms, findings, treatment, and disposition. | Must | Clinic |
| FR-101 | The system MUST track immunizations, physical exams, dental, and vision screening records. | Must | Clinic |
| FR-102 | The system MUST manage medicine inventory (stock, expiry, dispensing) for the school clinic. | Must | Clinic |
| FR-103 | The system MUST support emergency workflows: flag, guardian notification, and transport log. | Must | Clinic |
| FR-104 | The system SHOULD support referral to guidance or external facilities with consent. | Should | Clinic |
| FR-105 | The system MUST keep health data access restricted to nurse, school head, and authorized health personnel. | Must | Clinic |
| FR-106 | The system SHOULD support epidemic/disease surveillance counts (e.g., dengue, flu) for division roll-up. | Should | Clinic |

## 11. Guidance

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-107 | The system MUST maintain guidance case records (referrals, intakes, interventions, follow-ups) with consent flags. | Must | Guidance |
| FR-108 | The system MUST support individual counseling notes with restricted access (guidance staff only). | Must | Guidance |
| FR-109 | The system MUST track parent conferences: scheduling, attendees, notes, and action items. | Must | Guidance |
| FR-110 | The system MUST support group sessions (orientation, seminars, classroom guidance) with attendance. | Should | Guidance |
| FR-111 | The system SHOULD flag at-risk learners (attendance, grades, discipline) for guidance review using AI insights. | Should | Guidance |
| FR-112 | The system MUST log discipline cases and interventions with escalation to principal as configured. | Should | Guidance |
| FR-113 | The system MUST support DPA-safe sharing of guidance summaries (consent recorded) and SHOULD redact by default in exports. | Must | Guidance |

## 12. Property Management

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-114 | The system MUST maintain an inventory of school property (equipment, furniture, ICT assets) with serial/tag numbers and location. | Must | Property |
| FR-115 | The system MUST track assignments (issued to teacher/room) and transfers with history. | Must | Property |
| FR-116 | The system MUST support custodial reports and semi-annual physical inventory (PAR/IAR-aligned fields). | Must | Property |
| FR-117 | The system MUST record repairs, maintenance, and condemnation with approval. | Should | Property |
| FR-118 | The system SHOULD track ICT assets (laptops, tablets, projectors) separately with warranty and maintenance contracts. | Should | Property |
| FR-119 | The system MUST generate inventory summaries exportable for school and division reporting. | Must | Property |

## 13. Research

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-120 | The system MUST manage research studies (title, type, proponent, funding, status) across school, division, and region. | Must | Research |
| FR-121 | The system MUST implement BERF workflow: proposal, review, approval, funding, progress reports, and completion. | Must | Research |
| FR-122 | The system SHOULD provide survey/quiz tooling for researchers to collect data from respondents. | Should | Research |
| FR-123 | The system MUST maintain a research repository with approved access controls and citation/export. | Should | Research |
| FR-124 | The system SHOULD flag studies requiring ethics review and track clearance documents. | Should | Research |
| FR-125 | The system MUST restrict learner-data research access per RA 10173 and SHALL require data-sharing agreements. | Must | Research |

## 14. Communication

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-126 | The system MUST support announcements with role/section targeting and scheduled publishing. | Must | Comm |
| FR-127 | The system MUST deliver notifications via push (mobile), email, and SMS with per-message delivery status. | Must | Comm |
| FR-128 | The system MUST support SMS content in Filipino/English with 160-character segmentation handled by provider. | Must | Comm |
| FR-129 | The system SHOULD support template messages (reminders, billing, absence, events) with variable substitution. | Should | Comm |
| FR-130 | The system MUST support parent-teacher communication (messages, appointment requests) with opt-out controls. | Should | Comm |
| FR-131 | The system MUST record opt-out and unsubscribe events and MUST respect them per channel. | Must | Comm |
| FR-132 | The system MUST allow school admins to view send logs, delivery rates, and costs. | Must | Comm |
| FR-133 | The system SHOULD support broadcast to whole divisions/regions by division_admin/region_admin. | Should | Comm |

## 15. Reports (SF1–SF6 and operational)

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-134 | The system MUST generate SF1 (class list), SF2 (daily attendance), SF3 (books issued), SF4 (reports on promotion), SF5 (promotion/graduation), SF6 (enrollment summary) from live data. | Must | Reports |
| FR-135 | Report templates MUST be versioned and updatable without redeployment. | Must | Reports |
| FR-136 | The system MUST export reports to PDF, Excel (XLSX), and CSV with print-ready layout. | Must | Reports |
| FR-137 | The system MUST support the LIS upload format export for enrolment data. | Must | Reports |
| FR-138 | The system SHOULD provide operational reports: enrollment by year level, dropout, promotion rate, age-grade, gender parity, and finance collections. | Should | Reports |
| FR-139 | Division/region admins MUST be able to generate consolidated reports across their tree. | Must | Reports |
| FR-140 | Reports MUST reflect only finalized data where the report type requires it, and MUST state the as-of timestamp. | Must | Reports |

## 16. AI Features

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-141 | The system SHOULD detect attendance anomalies (patterns of lateness, repeated absence) and alert advisers. | Should | AI |
| FR-142 | The system SHOULD provide early risk flags for learners (grades + attendance + clinic/guidance signals) via explainable rules. | Should | AI |
| FR-143 | The system MAY provide grade prediction/progress projections with explicit uncertainty and no student-facing exposure by default. | Could | AI |
| FR-144 | The system SHOULD assist with message drafting (parent letters, reminders) in Filipino/English with human confirmation. | Should | AI |
| FR-145 | The system MAY provide an admin copilot answering operational questions from approved data. | Could | AI |
| FR-146 | The system MAY provide OCR for legacy forms (SF documents, SOA receipts) into structured records. | Could | AI |
| FR-147 | All AI outputs MUST be auditable, MUST NOT auto-perform high-stakes actions, and MUST expose their data sources. | Must | AI |

## 17. Mobile App (Flutter)

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-148 | The app MUST run on Android 9+ (API 28+) including tablets and Chromebooks, and iOS. | Must | Mobile |
| FR-149 | The app MUST be offline-first: reads served from local store, writes queued and synced with conflict resolution (last-write-wins with audit). | Must | Mobile |
| FR-150 | The app MUST show sync status and pending-item counts (see offline indicator, deliverable 11). | Must | Mobile |
| FR-151 | The app MUST support QR-based attendance scanning for teachers; RFID/NFC SHOULD be supported on devices with readers. | Must | Mobile |
| FR-152 | The app MUST support biometric unlock (fingerprint/face) via platform secure enclave. | Must | Mobile |
| FR-153 | The app SHOULD provide home-screen widgets (attendance today, pending approvals, announcements). | Should | Mobile |
| FR-154 | The app SHOULD support background sync with batching and SHOULD resume interrupted syncs. | Should | Mobile |
| FR-155 | The app MUST support push notifications with deep links to the relevant screen. | Must | Mobile |
| FR-156 | The app MUST cache recently viewed data (schedules, grade books, catalogs) for offline browsing. | Should | Mobile |

## 18. System Administration

| ID | Requirement | Priority | Module |
|---|---|---|---|
| FR-157 | The system MUST provide school-level configuration: school year, calendar terms, fee items, report templates, and module toggles. | Must | SysAdmin |
| FR-158 | The system MUST provide audit log browsing with filters (actor, action, object, date) and export. | Must | SysAdmin |
| FR-159 | The system MUST provide user management (create, assign roles, deactivate, reset) at appropriate tree nodes. | Must | SysAdmin |
| FR-160 | The system MUST support maintenance windows with a visible maintenance page and no data loss. | Must | SysAdmin |
| FR-161 | The system MUST provide tenant (school/division) metadata management and archiving. | Must | SysAdmin |
| FR-162 | The system SHOULD provide import tools (learner lists, teacher lists, SF data) with dry-run validation. | Should | SysAdmin |
| FR-163 | The system MUST support export of all tenant data (data portability) upon authorized request. | Should | SysAdmin |

## Priority summary

| Priority | Count | Meaning |
|---|---|---|
| Must | 106 | Required for launch; acceptance criteria |
| Should | 52 | Strongly expected in year 1; feature-flagged |
| Could | 5 | Vision; roadmap-gated (deliverables 29–30) |

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable 3 of 30.*
