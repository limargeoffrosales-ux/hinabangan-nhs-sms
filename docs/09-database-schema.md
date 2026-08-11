# Database Schema

MeridianEd is a secure, cloud-native, AI-powered, mobile-first school management
ecosystem that centralizes academic, administrative, financial, HR, health,
guidance, research, and operational data for elementary schools, junior/senior
high schools, colleges, universities, school divisions, and regional offices.
This document specifies column-level schemas for the **core MVP tables** and a
compact summary of the additional production tables from the ERD
(Deliverable 7). The executable SQL lives in `../database/migrations/` — this
document is the reference, not the source of truth. MeridianEd is a placeholder
brand — the name is rebrandable at any time.

> **MVP note**: the MVP runs PostgreSQL (or `node:sqlite` locally) from the
> same migration files; types below describe the PostgreSQL 16 dialect.

## 1. Conventions

- `id` is `uuid` in production (`bigserial` in the MVP); all FKs are `<table>_id`.
- `created_at` / `updated_at` are `timestamptz NOT NULL DEFAULT now()`.
- Soft delete via nullable `deleted_at`.
- `tenant_id` references `tenants` on every tenant-scoped table; access is
  row-scoped through the region → division → school tree.
- Money is `NUMERIC(12,2)` in PHP. LRN is a 12-digit zero-padded string
  (`XXXXXXXXXXXX`).
- `audit_logs` is append-only; no `UPDATE`/`DELETE` grants exist for it.

## 2. Core MVP tables

### 2.1 users

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid/bigserial | PK | Internal identifier |
| username | varchar(64) | UNIQUE, NOT NULL | Login name |
| email | varchar(255) | UNIQUE, NOT NULL | Contact email |
| password_hash | varchar(255) | NOT NULL | bcrypt/argon2 hash |
| full_name | varchar(150) | NOT NULL | Display name |
| tenant_id | uuid/bigint | FK → tenants | Scoping node (school/division/region) |
| status | varchar(20) | NOT NULL DEFAULT 'active' | active / disabled / locked |
| failed_attempts | smallint | NOT NULL DEFAULT 0 | Lockout after 5 |
| password_changed_at | timestamptz | NOT NULL DEFAULT now() | 90-day expiry basis |
| last_login_at | timestamptz | NULL | Session audit |
| created_at, updated_at | timestamptz | NOT NULL | Audit timestamps |
| deleted_at | timestamptz | NULL | Soft delete |

### 2.2 roles

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid/bigserial | PK | Internal identifier |
| name | varchar(50) | UNIQUE, NOT NULL | Role key per style guide (teacher, registrar, ...) |
| description | varchar(255) | NULL | Human-readable purpose |
| is_system | boolean | NOT NULL DEFAULT false | System roles cannot be renamed/deleted |
| created_at, updated_at | timestamptz | NOT NULL | Audit timestamps |

### 2.3 user_roles

| Column | Type | Constraints | Description |
|---|---|---|---|
| user_id | uuid/bigint | FK → users, PK (composite) | Grantee |
| role_id | uuid/bigint | FK → roles, PK (composite) | Granted role |
| granted_by | uuid/bigint | FK → users | Auditor of grant |
| created_at | timestamptz | NOT NULL | Grant time |

### 2.4 students

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid/bigserial | PK | Internal identifier |
| lrn | varchar(12) | UNIQUE (tenant_id, lrn), NOT NULL | DepEd 12-digit learner reference |
| first_name | varchar(100) | NOT NULL | Given name |
| middle_name | varchar(100) | NULL | Middle name |
| last_name | varchar(100) | NOT NULL | Surname |
| name_ext | varchar(10) | NULL | Jr., III |
| birth_date | date | NOT NULL | Date of birth |
| sex | char(1) | NOT NULL, CHECK (sex IN ('M','F')) | Biological sex per DepEd forms |
| grade_level | smallint | NOT NULL | K–12 level (1–12) |
| strand | varchar(20) | NULL | SHS track/strand (Academic, TVL, Sports, Arts & Design) |
| address | varchar(255) | NULL | Home address |
| contact_no | varchar(20) | NULL | Guardian/learner phone |
| guardian_name | varchar(150) | NULL | MVP denormalized guardian |
| guardian_phone | varchar(20) | NULL | MVP denormalized guardian phone |
| status | varchar(20) | NOT NULL DEFAULT 'active' | active / transferred / graduated / withdrawn |
| tenant_id | uuid/bigint | FK → tenants, NOT NULL | Owning school |
| created_at, updated_at | timestamptz | NOT NULL | Audit timestamps |
| deleted_at | timestamptz | NULL | Soft delete |

### 2.5 teachers

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid/bigserial | PK | Internal identifier |
| employee_no | varchar(30) | UNIQUE, NOT NULL | School employee number |
| prc_no | varchar(30) | NULL | PRC license number |
| prc_validity | date | NULL | PRC license expiry |
| first_name, middle_name, last_name, name_ext | varchar(100) / varchar(10) | NOT NULL / NULL | Name parts |
| sex | char(1) | NOT NULL | M / F |
| birth_date | date | NULL | Date of birth |
| position | varchar(100) | NULL | e.g. Teacher I, Master Teacher |
| specialization | varchar(100) | NULL | Subject area specialization |
| email | varchar(255) | NULL | Work email |
| phone | varchar(20) | NULL | Contact number |
| status | varchar(20) | NOT NULL DEFAULT 'active' | active / on-leave / resigned |
| tenant_id | uuid/bigint | FK → tenants, NOT NULL | Employing school |
| created_at, updated_at | timestamptz | NOT NULL | Audit timestamps |

### 2.6 subjects

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid/bigserial | PK | Internal identifier |
| code | varchar(20) | NOT NULL | e.g. MATH8 |
| name | varchar(120) | NOT NULL | e.g. Mathematics 8 |
| grade_level | smallint | NOT NULL | K–12 level |
| strand | varchar(20) | NULL | SHS strand (for senior high) |
| units | numeric(4,1) | NULL | Credit units |
| description | varchar(255) | NULL | Syllabus note |
| tenant_id | uuid/bigint | FK → tenants, NOT NULL | Offering tenant |
| created_at, updated_at | timestamptz | NOT NULL | Audit timestamps |

### 2.7 sections

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid/bigserial | PK | Internal identifier |
| name | varchar(50) | NOT NULL | e.g. Grade 7 – Sampaguita |
| grade_level | smallint | NOT NULL | K–12 level |
| strand | varchar(20) | NULL | SHS strand when applicable |
| adviser_teacher_id | uuid/bigint | FK → teachers, NULL | Adviser |
| school_year | varchar(9) | NOT NULL | e.g. 2026-2027 |
| capacity | smallint | NOT NULL DEFAULT 40 | Max enrollment |
| room | varchar(50) | NULL | Room/lab assignment |
| tenant_id | uuid/bigint | FK → tenants, NOT NULL | Owning school |
| created_at, updated_at | timestamptz | NOT NULL | Audit timestamps |

### 2.8 enrollments

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid/bigserial | PK | Internal identifier |
| student_id | uuid/bigint | FK → students, NOT NULL | Enrolled learner |
| section_id | uuid/bigint | FK → sections, NOT NULL | Target section |
| school_year | varchar(9) | NOT NULL | e.g. 2026-2027 |
| status | varchar(20) | NOT NULL DEFAULT 'pending' | pending / enrolled / dropped / transferred |
| enrollment_date | date | NOT NULL DEFAULT current_date | Effective date |
| remarks | varchar(255) | NULL | Transfer/drop notes |
| UNIQUE (student_id, school_year) | — | CONSTRAINT | One active enrollment per year |
| created_at, updated_at | timestamptz | NOT NULL | Audit timestamps |

### 2.9 attendance

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid/bigserial | PK | Internal identifier |
| student_id | uuid/bigint | FK → students, NOT NULL | Learner |
| section_id | uuid/bigint | FK → sections, NOT NULL | Section on the date |
| date | date | NOT NULL | Attendance day |
| status | varchar(20) | NOT NULL | present / late / absent / excused |
| time_in | time | NULL | Actual arrival |
| remarks | varchar(255) | NULL | Note (e.g. medical) |
| marked_by | uuid/bigint | FK → users, NOT NULL | Marking teacher |
| UNIQUE (student_id, date) | — | CONSTRAINT | One record per learner per day |
| created_at, updated_at | timestamptz | NOT NULL | Audit timestamps |

### 2.10 grades

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid/bigserial | PK | Internal identifier |
| student_id | uuid/bigint | FK → students, NOT NULL | Learner |
| subject_id | uuid/bigint | FK → subjects, NOT NULL | Subject |
| section_id | uuid/bigint | FK → sections, NOT NULL | Section |
| school_year | varchar(9) | NOT NULL | Academic period |
| quarter | smallint | NOT NULL, CHECK (quarter BETWEEN 1 AND 4) | Grading quarter |
| component | varchar(30) | NOT NULL | written_work / performance_task / quarterly_assessment |
| score | numeric(6,2) | NOT NULL | Raw score |
| max_score | numeric(6,2) | NOT NULL | Denominator |
| teacher_id | uuid/bigint | FK → users, NOT NULL | Entering teacher |
| remarks | varchar(255) | NULL | Optional note |
| created_at, updated_at | timestamptz | NOT NULL | Audit timestamps |

### 2.11 announcements

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid/bigserial | PK | Internal identifier |
| title | varchar(200) | NOT NULL | Headline |
| body | text | NOT NULL | Content |
| audience | varchar(30) | NOT NULL DEFAULT 'all' | all / role / section / tenant |
| role_filter | varchar(50) | NULL | Audience role when targeted |
| tenant_id | uuid/bigint | FK → tenants, NOT NULL | Scoping node |
| created_by | uuid/bigint | FK → users, NOT NULL | Author |
| published_at | timestamptz | NULL | NULL = draft; future = scheduled |
| expires_at | timestamptz | NULL | Auto-hide date |
| created_at, updated_at | timestamptz | NOT NULL | Audit timestamps |

### 2.12 audit_logs

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | bigserial | PK | Monotonic append-only |
| user_id | uuid/bigint | FK → users, NULL | Actor (NULL = system) |
| tenant_id | uuid/bigint | FK → tenants, NULL | Tenant scope |
| action | varchar(50) | NOT NULL | e.g. grade.updated |
| entity | varchar(50) | NOT NULL | Table name |
| entity_id | varchar(64) | NOT NULL | Row identifier |
| old_values | jsonb | NULL | Prior snapshot |
| new_values | jsonb | NULL | New snapshot |
| ip_address | inet | NULL | Client IP |
| user_agent | varchar(255) | NULL | Client UA |
| created_at | timestamptz | NOT NULL DEFAULT now() | Event time |

Immutable: no UPDATE/DELETE grants; retention 7 years (DepEd/RA 10173).

### 2.13 refresh_tokens

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | Token record id |
| user_id | uuid/bigint | FK → users, NOT NULL | Owner |
| token_hash | varchar(64) | NOT NULL, UNIQUE | SHA-256 of token (never plaintext) |
| expires_at | timestamptz | NOT NULL | 14 days |
| revoked_at | timestamptz | NULL | Revocation time |
| replaced_by | uuid | NULL | Rotation chain pointer |
| ip_address | inet | NULL | Issue IP |
| created_at | timestamptz | NOT NULL | Issue time |

### 2.14 app_settings

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid/bigserial | PK | Internal identifier |
| tenant_id | uuid/bigint | FK → tenants, NULL | NULL = system-wide |
| key | varchar(100) | NOT NULL | Setting key |
| value | jsonb | NOT NULL | Typed value |
| updated_by | uuid/bigint | FK → users, NULL | Last editor |
| updated_at | timestamptz | NOT NULL | Edit time |
| UNIQUE (tenant_id, key) | — | CONSTRAINT | One value per key |

## 3. Additional production tables (summary)

| Table | Purpose | Key columns |
|---|---|---|
| tenants | Region/division/school tree | name, type, parent_id |
| permissions | Granular action rights | code, description |
| role_permissions | Role ↔ permission mapping | role_id, permission_id |
| school_years | Academic periods | name (2026-2027), start/end, status |
| guardians | Parent/guardian profiles | full_name, phone, relation |
| student_guardians | Student ↔ guardian links | student_id, guardian_id, is_primary |
| curriculum | K-12 curriculum definitions | name, grade_level, type |
| curriculum_subjects | Curriculum ↔ subject mapping | curriculum_id, subject_id |
| competencies | MELC items | code (MELC), description, grade_level |
| subject_competencies | Subject ↔ MELC mapping | subject_id, competency_id |
| teacher_assignments | Teaching loads | teacher_id, subject_id, section_id, school_year |
| class_schedules | Timetables | section_id, subject_id, teacher_id, day, period, room |
| assessments | Exams/tasks | section_id, subject_id, type, date, max_score, weight |
| assessment_results | Per-student scores | assessment_id, student_id, score |
| report_cards | Final quarterly/annual grades | student_id, school_year, quarter, subject grades JSONB |
| dll_lesson_plans | Daily lesson logs | teacher_id, subject_id, date, objectives, MELC links |
| events | Calendar items | tenant_id, title, start/end, type |
| documents | SF-form/uploaded files | student_id, object_key, doc_type, uploaded_by |
| billing_invoices | Fees per student | student_id, school_year, items JSONB, total, balance |
| payments | Payment installments | invoice_id, amount, mode, or_no, paid_at |
| receipts | Official receipts | payment_id, or_no, receipt_number |
| library_books | Catalog | isbn, title, author, copies, status |
| book_borrows | Circulation | book_id, user_id, due_date, returned_at, fine |
| clinic_visits | Health consultations | student_id, nurse_id, date, findings, disposition |
| clinic_medicines | Medicine stock | name, stock_qty, expiry, reorder_level |
| medicine_dispenses | Dispensing ledger | visit_id, medicine_id, qty, dose |
| guidance_cases | Referrals | student_id, type, severity, status |
| guidance_sessions | Interventions | case_id, counselor_id, notes, outcome |
| property_assets | Asset register | tag (PAR/ICS), name, value, status, custodian |
| asset_movements | Transfers/disposals | asset_id, from_to, type, date, ref_no |
| research_proposals | BERF submissions | teacher_id, title, abstract, status, funding |
| research_reviews | BERF evaluation | proposal_id, reviewer_id, score, decision |
| payroll_runs | Payroll cycles | tenant_id, period, totals JSONB, status |
| employee_leaves | Leave requests | teacher_id, type, start/end, status, approver |
| ai_logs | AI interaction audit | user_id, prompt, response, model, latency |
| notifications | In-app push inbox | user_id, type, payload JSONB, read_at |

## 4. Where the SQL lives

The executable migrations for all tables above are versioned SQL files in
`../database/migrations/` (see Deliverable 25 for the migration plan). The
PostgreSQL dialect is authoritative; the `node:sqlite` fallback mirrors it for
local development only.

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable 9 of 30.*
