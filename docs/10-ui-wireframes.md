# MeridianEd — UI Wireframes

MeridianEd is a secure, cloud-native, AI-powered, mobile-first school management
ecosystem that centralizes academic, administrative, financial, HR, health,
guidance, research, and operational data for elementary schools, junior/senior
high schools, colleges, universities, school divisions, and regional offices.
This deliverable defines the web portal's screen-level layout as ASCII wireframes
plus the design system. Wireframes are structural, not pixel-perfect; they
describe zones, navigation, and content placement. The Android app screens are
covered separately in deliverable 11, and role-specific dashboards in
deliverable 12.

> MeridianEd is a placeholder brand — the name is rebrandable at any time.

## 1. Login

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                    ┌─────────────────────┐                   │
│                    │   [MeridianEd logo] │                   │
│                    │                     │                   │
│                    │  Email or LRN       │                   │
│                    │  ┌───────────────┐  │                   │
│                    │  │ user@school   │  │                   │
│                    │  └───────────────┘  │                   │
│                    │  Password           │                   │
│                    │  ┌───────────────┐  │                   │
│                    │  │ ••••••••••••  │  │                   │
│                    │  └───────────────┘  │                   │
│                    │  [x] Remember me    │                   │
│                    │  ┌─────────────┐    │                   │
│                    │  │   SIGN IN   │    │                   │
│                    │  └─────────────┘    │                   │
│                    │  Forgot password?   │                   │
│                    │  Sign in with SSO   │                   │
│                    │  [Google][DepEd]    │                   │
│                    └─────────────────────┘                   │
│  Help desk: support@meridianed.ph · RA 10173 notice          │
└──────────────────────────────────────────────────────────────┘
```

## 2. Admin Dashboard (MVP)

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ MeridianEd ▾ School: Mabini NHS       [SEARCH] [N. Reyes ▾]   │
├──────────┬───────────────────────────────────────────────────┤
│ NAV       │ Overview of SY 2026-2027                         │
│ Dashboard │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │
│ Students  │ │ 1,248  │ │ 92.4%  │ │ 1,204  │ │ ₱1.2M  │     │
│ Grades    │ │ Enrolled│ │Attend. │ │Present │ │Collected│    │
│ Attendance│ └────────┘ └────────┘ └────────┘ └────────┘     │
│ Finance   │ ┌─────────────────────┐ ┌─────────────────────┐  │
│ Library   │ │ Enrollment trend    │ │ Attendance by grade │  │
│ Clinic    │ │ ▁▂▃▅▆█▇▅▃ [chart]   │ │ ██▇▆▅▄▃ [bars]     │  │
│ Guidance  │ └─────────────────────┘ └─────────────────────┘  │
│ Research  │ ┌─────────────────────────────────────────────┐  │
│ Reports   │ │ Announcements (latest 5)                     │  │
│ Settings  │ │ [08-11] PTA meeting Fri 4PM · [08-10] ...   │  │
│           │ └─────────────────────────────────────────────┘  │
├──────────┴───────────────────────────────────────────────────┤
│ Synced 08:12 · Sync ✓                                        │
└──────────────────────────────────────────────────────────────┘
```

## 3. Student Profile

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ Students  ›  Profile                                        │
├──────────┬───────────────────────────────────────────────────┤
│ NAV       │ ┌─────────────────────────────────────────────┐  │
│ (as 2)    │ │ [photo] Reyes, Ana Marie D.   LRN: 123456789012│
│           │ │ Grade 7 – Section Mabini · Adviser: T. Cruz │  │
│           │ │ Status: ENROLLED  · SY 2026-2027 (1st Sem)   │  │
│           │ └─────────────────────────────────────────────┘  │
│           │ ┌────────────┬────────────┬────────────────────┐ │
│           │ │ Bio data   │ Guardian   │ Health              │ │
│           │ │ DOB 03/14..│ Mother     │ Allergies: peanuts  │ │
│           │ │ Sex F      │ 0917...    │ BP 110/70 03/2026   │ │
│           │ └────────────┴────────────┴────────────────────┘ │
│           │ ┌─────────────────────────────────────────────┐  │
│           │ │ Quick actions: [Edit] [Transfer] [SF9]     │  │
│           │ │ [Enroll next SY] [Print ID] [Enrollment hist]│ │
│           │ └─────────────────────────────────────────────┘  │
└──────────┴───────────────────────────────────────────────────┘
```

## 4. Class Record / Grades

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ Grades  ›  Class Record                                     │
├──────────┬───────────────────────────────────────────────────┤
│ NAV       │ G7-Mabini · Math 7 · T. Cruz · Q1 · [2026-27]    │
│           │ Assessments: [Written] [Performance] [Quarterly] │
│           │ ┌──────┬──────────┬────────────────────────────┐ │
│           │ │ No.  │ Learner  │ WW1 WW2 PT1 PT2 QA  Transm │ │
│           │ │ 1    │ Reyes, A │ 20  22  18  20  42   89    │ │
│           │ │ 2    │ Santos,B │ 18  19  15  17  38   84    │ │
│           │ │ ...  │ (48 rows)│                             │ │
│           │ │ Sum / Highest / Lowest / MPS: 86.2            │ │
│           │ └──────┴──────────┴────────────────────────────┘ │
│           │ [Add assessment] [Import] [Post to SF9] [SF9 ▾]  │
│           │ Unsaved: 3 changes · Last saved 08:14             │
└──────────┴───────────────────────────────────────────────────┘
```

## 5. Attendance Scanner (web)

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ Attendance  ›  Scanner                                      │
├──────────┬───────────────────────────────────────────────────┤
│ NAV       │ Class: G7-Mabini · 08:12 AM · Period 1           │
│           │ ┌─────────────────────────────────────────────┐  │
│           │ │            ┌───────────┐                    │  │
│           │ │            │ [CAMERA]  │                    │  │
│           │ │            │ scan area │                    │  │
│           │ │            └───────────┘                    │  │
│           │ │ QR / RFID / Face · Manual entry fallback    │  │
│           │ └─────────────────────────────────────────────┘  │
│           │ Just scanned:                                  │  │
│           │  ✓ 08:12 Reyes, Ana M.      [Undo]             │  │
│           │  ✓ 08:12 Santos, B.         [Undo]             │  │
│           │ ┌───────────────────────────────┬────────────┐  │
│           │ │ Present 34 · Absent 2 · Late 1 │ [Close]   │  │
│           │ └───────────────────────────────┴────────────┘  │
└──────────┴───────────────────────────────────────────────────┘
```

## 6. Finance / Billing

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ Finance  ›  Billing  ›  Learner SOA                         │
├──────────┬───────────────────────────────────────────────────┤
│ NAV       │ Reyes, Ana Marie D.  LRN 123456789012 · G7       │
│           │ ┌─────────────────────────────────────────────┐  │
│           │ │ Fee item          Amount  Paid   Balance    │  │
│           │ │ Tuition          ₱8,000  ₱8,000    ₱0       │  │
│           │ │ PTA contribution   ₱500    ₱500    ₱0       │  │
│           │ │ Books/Materials  ₱1,200    ₱300  ₱900       │  │
│           │ │ Uniform          ₱1,000    ₱0   ₱1,000      │  │
│           │ │ TOTAL           ₱10,700  ₱8,800 ₱1,900     │  │
│           │ └─────────────────────────────────────────────┘  │
│           │ Payments: [Record] [GCash/Maya match] [Receipt] │
│           │ [08-09] GCash REF 71234 ₱300  [Confirm] [Split] │
│           │ History: 08-01 Cash ₱8,500 · 08-09 GCash ₱300   │
└──────────┴───────────────────────────────────────────────────┘
```

## 7. Library

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ Library  ›  Catalog                                         │
├──────────┬───────────────────────────────────────────────────┤
│ NAV       │ [Search title/author/ISBN      ] [Filter ▾] [Add]│
│           │ ┌───────────┬───────────┬──────────────────────┐ │
│           │ │ Title     │ Author    │ Status / Copies      │ │
│           │ │ Noli Me    │ Rizal,J  │ In:3/5 · 1 out · 1 on│ │
│           │ │ Tangere    │          │ hold                 │ │
│           │ │ Florante.. │ Balagtas │ In:2/2               │ │
│           │ │ ...        │          │                      │ │
│           │ └───────────┴───────────┴──────────────────────┘ │
│           │ Active borrower: [Scan QR] [Enter LRN]           │
│           │ [Check out] [Check in] [Renew] [Reserve]         │
└──────────┴───────────────────────────────────────────────────┘
```

## 8. Clinic

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ Clinic  ›  Consultation                                     │
├──────────┬───────────────────────────────────────────────────┤
│ NAV       │ Learner: [Search or scan ID           ]          │
│           │ ┌─────────────────────────────────────────────┐  │
│           │ │ Reyes, Ana M. · G7 · Allergies: peanuts     │  │
│           │ │ Last visit: 08-03 (headache, paracetamol)   │  │
│           │ └─────────────────────────────────────────────┘  │
│           │ Visit record:                                  │  │
│           │ Time: [08:15]  Symptoms: [headache, fever]     │  │
│           │ Findings: [____________________________]        │  │
│           │ Treatment: [paracetamol 500mg] · Dispensed: [1]│  │
│           │ Disposition: [Returned to class] [Home] [Refer]│  │
│           │ [Save visit] [Notify guardian] [Medicine stock]│  │
│           │ Stock: Paracetamol 12 · ORS 8 · Betadine 6     │  │
└──────────┴───────────────────────────────────────────────────┘
```

## 9. Announcements

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ Announcements  ›  Composer                                  │
├──────────┬───────────────────────────────────────────────────┤
│ NAV       │ Title    [PTA General Assembly — Aug 15]         │
│           │ Audience [Parents of G7 ▾] [+ Add audience]      │
│           │ Channels [x] Push  [x] Email  [x] SMS (₱0.75)   │
│           │ Publish  [Immediately] [Schedule 08-14 16:00]    │
│           │ ┌─────────────────────────────────────────────┐  │
│           │ │ Body (markdown, Filipino/English)           │  │
│           │ │ Dear parents,...                            │  │
│           │ └─────────────────────────────────────────────┘  │
│           │ [Save draft] [Send] · Cost preview ₱187.50      │
│           │ Sent history: 08-09 3 ch · 96% delivered        │
└──────────┴───────────────────────────────────────────────────┘
```

## 10. Settings

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ Settings  ›  School Profile                                 │
├──────────┬───────────────────────────────────────────────────┤
│ NAV       │ ┌──────────────┬──────────────────────────────┐  │
│           │ │ School       │ Mabini NHS · 301234 · DepEd  │  │
│           │ │ Term/SY      │ SY 2026-2027 · Sem 1 · Cal   │  │
│           │ │ Grading      │ DepEd transmutation ▾ [Edit] │  │
│           │ │ Fee items    │ 4 items · ₱10,700 G7         │  │
│           │ │ Notification │ Push/Email/SMS budgets       │  │
│           │ │ Modules      │ [x] Library [x] Clinic [ ] R │  │
│           │ │ Data         │ [Export all] [Archive SY]    │  │
│           │ │ Audit log    │ 1,204 entries this month     │  │
│           │ └──────────────┴──────────────────────────────┘  │
│           │ Danger zone: [Deactivate school] (audited)      │
└──────────┴───────────────────────────────────────────────────┘
```

## Design system

### 2.1 Color

Material 3 scheme. Primary brand: Meridian Blue `#1A5BFF` (day) with
surface tint and inverse colors generated per Material 3 tokens. Secondary:
teal `#0B8A7D`; tertiary: amber `#C4820E` (warnings, honors highlights).
Semantic colors: success `#2E7D32`, error `#C62828`, info `#1565C0`.

| Token | Day | Night |
|---|---|---|
| `primary` | `#1A5BFF` | `#9DB8FF` |
| `surface` | `#FAF9FD` | `#14151A` |
| `on-surface` | `#1A1B20` | `#E4E1E6` |
| `surface-variant` | `#E2E1EC` | `#44464F` |
| `error` | `#C62828` | `#FFB4AB` |

### 2.2 Typography

Material 3 type scale with Roboto family; fallback to system fonts on
Android/Chromebook. Display 36/44, Headline 28/36, Title 22/28, Body 14/20
(p-size/line-height). Numeric data uses tabular figures. Filipino and English
share one type scale; no italic dependence for emphasis (readability and
localization).

### 2.3 Layout and spacing

8-px grid, 4-px spacing units; max content width 1200 px on the web portal,
sidebar 256 px, topbar 64 px. Cards with 16-px radius (rounded-xl), standard
Material 3 elevation (level 1 for cards, level 3 for dialogs). Table density:
compact for class records (48 rows visible per page).

### 2.4 Dark and light mode

Both themes MUST be token-driven (Material 3 light/dark color roles), toggled
per account and via system preference. Night mode must maintain WCAG 2.2 AA
contrast; charts get night palettes automatically.

### 2.5 Glassmorphism notes

Used sparingly: topbar and floating action bars MAY use translucent surfaces
(backdrop blur ≥ 24 px, 70% surface opacity) over scrolling content. Glass
effects MUST NOT be used on data tables, forms, or text-heavy panels, and MUST
degrade gracefully (opaque fallback) where backdrop-filter is unsupported.

### 2.6 MVP note

The MVP web portal (React 19 + Vite) implements this design system in light
mode with the Meridian Blue primary, the tokens above, sidebar layout, and the
MVP dashboard from wireframe 2. Dark mode, glassmorphism, and full Material 3
dynamic color are production polish, not MVP blockers.

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable 10 of 30.*
