# User Flow Diagrams

MeridianEd is a secure, cloud-native, AI-powered, mobile-first school management
ecosystem that centralizes academic, administrative, financial, HR, health,
guidance, research, and operational data for elementary schools, junior/senior
high schools, colleges, universities, school divisions, and regional offices.
This deliverable documents the primary end-to-end user journeys as Mermaid
flowcharts. Flows assume production SLOs (availability 99.9%, JWT access 15 min,
refresh 14 days, password policy ≥ 12 chars) and the RBAC roles defined in the
style guide. Flows are written as vision-level; the runnable MVP implements
subsets of flows (b), (c), (g), and (h) at a smaller scale (Express + React 19 +
PostgreSQL).

> MeridianEd is a placeholder brand — the name is rebrandable at any time.

## 1. Flow conventions

| Symbol | Meaning |
|---|---|
| Rounded node | User action or system step |
| Diamond | Decision / branch point |
| Edge label (Yes/No) | Branch outcome |
| Parallel flows | Recorded in audit log at every terminal step |

All flows terminate in an append-only audit event retained 7 years (RA 10173 /
DepEd records rules). Timezone is Asia/Manila (UTC+8); money amounts are in PHP (₱).

## 2. (a) First-time admin bootstrap

A `super_admin` (platform operator) provisions the first school. The chain
region → division → school is created before any school data exists. Each
administrator completes MFA enrollment on first login.

```mermaid
flowchart TD
    A[super_admin receives bootstrap invite] --> B[Create region_admin account]
    B --> C[region_admin creates division_admin]
    C --> D[division_admin creates school_admin]
    D --> E[school_admin completes first login and enrolls MFA]
    E --> F{School profile complete?}
    F -- No --> G[Upload school profile: name, DepEd ID, contact]
    F -- Yes --> H[Create staff accounts: principal, registrar, teacher]
    G --> H
    H --> I[Invites sent; each staff sets password and MFA]
    I --> J[School ready for first enrollment batch]
```

## 3. (b) Teacher login + class record grade entry

`teacher` authenticates, opens the class record for a subject/section, enters
component scores, and submits for principal review. Grading follows DepEd
K-12 computation (written work, performance tasks, quarterly assessment).

```mermaid
flowchart TD
    A[Teacher opens portal or mobile app] --> B[Enter credentials]
    B --> C[Keycloak validates password and MFA if enrolled]
    C --> D{Valid?}
    D -- No --> E[Failed attempt counted; 5 attempts lock 15 min]
    E --> B
    D -- Yes --> F[JWT access 15 min + refresh 14 days issued]
    F --> G[Open class record for subject and section]
    G --> H[Enter raw scores per component]
    H --> I[System computes final rating per DepEd formula]
    I --> J[Preview class record before submission]
    J --> K{All learners graded?}
    K -- No --> H
    K -- Yes --> L[Submit to principal; audit log appended]
```

## 4. (c) Student enrollment (DepEd LRN flow)

`registrar` validates the 12-digit LRN (`XXXXXXXXXXXX`) against DepEd e-LIS or
requests issuance, then enrolls the learner into a grade level and section.
The learner is added to SF1 and to all class lists.

```mermaid
flowchart TD
    A[Registrar creates learner intake record] --> B[Capture PSA birth certificate data]
    B --> C{Has existing LRN?}
    C -- Yes --> D[Validate LRN against DepEd Learner Information System]
    C -- No --> E[Request LRN issuance via DepEd e-LIS]
    D --> F{LRN confirmed?}
    E --> F
    F -- No --> G[Coordinate with DepEd records officer]
    G --> E
    F -- Yes --> H[Enroll learner in grade level and section]
    H --> I[Attach previous school records SF9/SF10 as applicable]
    I --> J[Learner appears in SF1 and class lists]
```

## 5. (d) Attendance QR check-in

The learner's app fetches a time-bound QR; the teacher device scans it and the
system records attendance against the section's schedule. Duplicates are
discarded.

```mermaid
flowchart TD
    A[Learner opens MeridianEd app] --> B[App fetches time-bound QR from server]
    B --> C[Teacher device scans QR at classroom]
    C --> D[System validates token and class-window binding]
    D --> E{Valid and within class window?}
    E -- No --> F[Mark unverified; prompt manual teacher check]
    E -- Yes --> G{Duplicate check-in?}
    G -- Yes --> H[Ignore duplicate; keep original timestamp]
    G -- No --> I[Record attendance: date, time, section, subject]
    I --> J[Attendance synced to class record and reports]
```

## 6. (e) Parent account linking via child code

`parent` registers, then links the child using a per-child code issued by the
school. The link is activated only after `school_admin` approval.

```mermaid
flowchart TD
    A[Parent registers with verified email or SMS] --> B[Parent requests child link]
    B --> C[School issues child code from learner record]
    C --> D[Parent enters child code]
    D --> E{Code valid and matches enrolled child?}
    E -- No --> F[Show error; max 5 attempts per session]
    E -- Yes --> G[Send link request to school_admin]
    G --> H{School approves?}
    H -- No --> I[Parent notified; may retry with a new code]
    H -- Yes --> J[Link active: grades, billing, attendance visible]
```

## 7. (f) Student billing payment via GCash/Maya

The student or `cashier` initiates payment from an assessment; the server
creates a signed payment session in PHP, redirects to GCash or Maya, and
verifies the provider callback before crediting the ledger.

```mermaid
flowchart TD
    A[Student or cashier opens billing statement] --> B[Select GCash or Maya]
    B --> C[Server creates payment session with PHP amount]
    C --> D[Redirect to GCash or Maya checkout]
    D --> E[User completes payment in provider app]
    E --> F[Provider callback webhook with signed payload]
    F --> G{Signature and amount match?}
    G -- No --> H[Reject and alert finance; flag payment for review]
    G -- Yes --> I[Ledger credited; official receipt generated]
    I --> J[Receipt visible to cashier and parent portal]
```

## 8. (g) Password reset

Reset requires an OTP sent to registered email or mobile. On success all
refresh tokens are revoked so only the new password is valid.

```mermaid
flowchart TD
    A[User selects Forgot password] --> B[Enter registered email or mobile]
    B --> C[System sends OTP with 10-minute expiry]
    C --> D[User enters OTP]
    D --> E{OTP valid?}
    E -- No --> F[3 failed attempts invalidate the OTP]
    E -- Yes --> G[Set new password: ≥ 12 chars, complexity]
    G --> H{Password policy met?}
    H -- No --> G
    H -- Yes --> I[Revoke all refresh tokens; force re-login]
    I --> J[Audit log records reset; user proceeds to login]
```

## 9. (h) Principal report generation SF1–SF6

`principal` generates DepEd School Forms (SF1 enrollment, SF2 daily attendance,
SF3 books, SF4 physical inventory, SF5 report on promotions, SF6 summarized
report) from live data, reviews for anomalies, certifies, and exports.

```mermaid
flowchart TD
    A[Principal opens Reports module] --> B[Select school year, quarter, and SF1-SF6]
    B --> C[System aggregates enrollment, grades, attendance data]
    C --> D[Preview generated report]
    D --> E{Data anomalies?}
    E -- Yes --> F[Drill into class records; correct source data]
    F --> C
    E -- No --> G[Approve and certify report]
    G --> H[Export PDF or submit to Division e-Submission]
    H --> I[Report archived; audit log appended]
```

## 10. Cross-flow security behaviors

Every flow inherits the platform security defaults:

| Behavior | Where enforced |
|---|---|
| JWT access 15 min, refresh 14 days with rotation | Flows (b), (d), (g) |
| MFA at first login for staff roles | Flows (a), (b) |
| Lockout after 5 failed attempts for 15 min | Flows (b), (g) |
| Immutable audit log, 7-year retention | All flows |
| Row-level tenant scoping (region/division/school) | All flows |
| Provider callback signature verification | Flow (f) |

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable 16 of 30.*
