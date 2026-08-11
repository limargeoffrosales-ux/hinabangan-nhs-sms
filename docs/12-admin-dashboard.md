# MeridianEd — Admin Dashboard

MeridianEd is a secure, cloud-native, AI-powered, mobile-first school management
ecosystem that centralizes academic, administrative, financial, HR, health,
guidance, research, and operational data for elementary schools, junior/senior
high schools, colleges, universities, school divisions, and regional offices.
This deliverable specifies the administrator dashboard: the global layout, the
widget catalog, role-specific variations (super_admin vs division vs school), and
the exact scope the MVP implements in the React web portal.

> MeridianEd is a placeholder brand — the name is rebrandable at any time.

## Layout

The dashboard follows the sidebar + topbar layout defined in deliverable 10 and
is consistent across roles; only widget sets and data scopes change.

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ MeridianEd ▾ Tenant: School/Division/Region  [SEARCH] [USER ▾] │
├──────────┬───────────────────────────────────────────────────┤
│ NAV       │ [Page title + date range selector ▾]             │
│ Overview │ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐ │
│ Learners │ │ KPI  ││ KPI  ││ KPI  ││ KPI  ││ KPI  ││ KPI  │ │
│ Academics│ └──────┘└──────┘└──────┘└──────┘└──────┘└──────┘ │
│ Finance  │ ┌────────────────────┬─────────────────────────┐  │
│ HR       │ │ Chart / heatmap    │ Chart / list            │  │
│ Ops      │ │                    │                         │  │
│ Reports  │ └────────────────────┴─────────────────────────┘  │
│ System   │ ┌────────────────────┬─────────────────────────┐  │
│          │ │ AI insights panel  │ Activity / audit feed   │  │
│          │ └────────────────────┴─────────────────────────┘  │
│          │ ┌─────────────────────────────────────────────┐  │
│          │ │ Task center · Approval center (stacked tabs)│  │
│          │ └─────────────────────────────────────────────┘  │
├──────────┴───────────────────────────────────────────────────┤
│ Server health · Cloud usage · Storage · Sync status          │
└──────────────────────────────────────────────────────────────┘
```

Layout rules: KPI cards in the first row (up to 6); charts in a two-column band;
AI insights and activity feed side by side; task/approval centers dock at the
bottom band with unread counters; the footer band shows operational telemetry.
Every widget deep-links to its source list (drill-down is mandatory).

## Widget catalog

| ID | Widget | Description | Roles |
|---|---|---|---|
| W-01 | KPI cards | Enrolled learners, attendance rate, collections, new approvals, pending reports, sync health | All admins |
| W-02 | Enrollment trend | Line/area chart of enrolment by month and grade level; YoY comparison | All admins |
| W-03 | Attendance heatmap | Days × sections matrix; color intensity = absence rate | School, division |
| W-04 | Performance charts | MPS by subject/grade; promotion/dropout rates; honors distribution | School, division |
| W-05 | Finance summary | Collections vs target, AR aging, channel mix (GCash/Maya/cash) | School finance, division |
| W-06 | AI insights | Auto-generated flags: attendance anomalies, at-risk learners, billing outliers; each item links to records and shows confidence and sources | School, division, region |
| W-07 | Department status | Per-department/grade-level operational status (submitted reports, pending actions) | Division, region, HEI dean |
| W-08 | Server health | API error rate, latency p95, queue depth, availability (99.9% target) | super_admin, ict |
| W-09 | Cloud usage | Compute, storage, egress; cost by service vs budget (GCP; AWS/Azure equivalents where used) | super_admin |
| W-10 | Storage | Object storage utilization, backup status, snapshot age, retention compliance | super_admin, ict |
| W-11 | User activity | Active users, logins by role, peak hours, top actions | All admins |
| W-12 | Audit feed | Live immutable audit stream (actor, action, object) with filters and export | super_admin, ict |
| W-13 | Task center | Personal and delegated tasks: unsubmitted SFs, unfinalized grades, overdue actions | All admins |
| W-14 | Approval center | Pending approvals: grade freezes, fee changes, payroll, purchases, transfers | School, division, region |

## Role-specific dashboard variations

### super_admin

Global operational view across tenants. Widgets: W-01 (aggregate), W-08, W-09,
W-10, W-12, W-14 (platform-level), plus tenant health list (per-school sync
status, availability, storage quotas). Scope: all schools, all divisions;
read-only on learner data unless the role is additionally scoped. This is the
only role with platform-level audit export and cost controls.

### division_admin / region_admin

Multi-school roll-up. Widgets: W-01 across schools, W-02 with school breakdown,
W-03 per school, W-06 aggregated flags, W-07 (school status), W-11, W-14
(division-level approvals such as BERF proposals). Every metric shows the
division tree (region → divisions → schools) and per-school deltas versus
targets. Announcements publish across schools.

### school_admin / principal

School operations. Widgets: W-01, W-02, W-03, W-04, W-05, W-06, W-11, W-13,
W-14 (school-level approvals: grade freeze, fee changes, payroll, purchase
requests). Principal additionally sees teacher workload and section health;
school_admin sees settings, imports, and user management.

### Departmental roles (nurse, librarian, cashier, HR, guidance, property)

See a department-scoped dashboard: their module KPIs (e.g., clinic visits and
stock levels; circulation; collection rates; leave balances; case load;
inventory status) plus their pending tasks, without the school-wide financial or
personnel views unless permitted by RBAC.

## Dashboard interactions

| Interaction | Behavior |
|---|---|
| Drill-down | Every KPI card and chart opens its source list (e.g., attendance rate → per-section table → per-learner record) |
| Date ranges | Global range selector (today, 7 days, this month, this quarter, school year) applies to all widgets consistently |
| Filters | Tenant tree filter (region → division → school) and module filter persist per user |
| Export | Every widget exports to CSV/PDF with the same as-of timestamp and data scope shown on the page |
| Personalization | Admins pin up to 6 widgets, reorder the grid, and save one custom view per role |
| Notification of thresholds | Admin sets thresholds (e.g., attendance < 85%); breach triggers push/email and a task-center item |
| Refresh | MVP: on load and manual refresh; vision: live updates for activity and audit feeds |

## Division dashboard sketch

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ SDO Calamba ▾ SY 2026-27  [Date range ▾]      [Export]    │
├──────────┬───────────────────────────────────────────────────┤
│ NAV       │ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐          │
│ Overview  │ │ 42    │ │ 94.1% │ │ 18    │ │ 4     │          │
│ Schools   │ │Schools│ │Attend.│ │SFs due│ │Overdue│          │
│ Learners  │ └───────┘ └───────┘ └───────┘ └───────┘          │
│ Finance   │ ┌─────────────────────┬─────────────────────────┐ │
│ Research  │ │ Enrollment by school │ Attendance heatmap      │ │
│ Reports   │ │ ▁▃▅▆▇▆▅▃ [bars]      │ ██▇▆▅▄▃ [matrix]       │ │
│ System    │ └─────────────────────┴─────────────────────────┘ │
│           │ ┌─────────────────────┬─────────────────────────┐ │
│           │ │ AI insights: 3 risk │ School status list      │ │
│           │ │ clusters             │ 36 green · 4 yellow     │ │
│           │ └─────────────────────┴─────────────────────────┘ │
│           │ ┌─────────────────────────────────────────────┐  │
│           │ │ Approval center: 6 BERF · 2 SF exceptions   │  │
│           │ └─────────────────────────────────────────────┘  │
└──────────┴───────────────────────────────────────────────────┘
```

## MVP dashboard scope

The runnable MVP (React 19 + Vite portal) implements a single school_admin-style
overview with four widgets, per the functional requirements (FR-21):

| Widget | MVP implementation |
|---|---|
| Student population | Total enrolled learners per school year, with grade-level breakdown table |
| Attendance rate | School-wide attendance percentage for the current period, with a 7-day trend |
| Enrollment trend | Enrolment by month/term across the last two school years (simple bar chart) |
| Announcements | Latest five published announcements with composer link |

The MVP also renders the sidebar navigation to all modules and a sync status
chip. W-03 through W-14, role-switching for super_admin/division, AI insights,
and the operational telemetry band are production scope (vision), gated by
feature flags; they do not block the MVP acceptance criteria.

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable 12 of 30.*
