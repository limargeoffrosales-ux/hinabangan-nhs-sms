# MeridianEd — Android App Screens

MeridianEd is a secure, cloud-native, AI-powered, mobile-first school management
ecosystem that centralizes academic, administrative, financial, HR, health,
guidance, research, and operational data for elementary schools, junior/senior
high schools, colleges, universities, school divisions, and regional offices.
This deliverable specifies the Android client — a Flutter 3 application targeting
Android 9+ (API 28+), including tablets and Chromebooks — screen by screen, with
the offline-first sync behavior that makes it usable in low-bandwidth schools.
iOS is a build target of the same Flutter codebase; this document scopes Android.

> MeridianEd is a placeholder brand — the name is rebrandable at any time.
> MVP note: the runnable Android shell in this repo is a Capacitor 8 wrapper
> around the React web portal; the Flutter client described here is the
> production target.

## Platform requirements

| Requirement | Detail |
|---|---|
| Minimum OS | Android 9 (API 28); targets current stable API at release |
| Form factors | Phones (320–480 dp width), tablets (600–960 dp), Chromebooks (desktop layout) |
| Framework | Flutter 3, Material 3, single codebase with adaptive layout |
| Offline model | Offline-first: local SQLite mirror, outbox queue, delta sync |
| Biometrics | BiometricPrompt (fingerprint/face), keys in Android Keystore |
| NFC/RFID | NFC reader API (ISO 14443/15693) for attendance and library; external USB RFID readers where supported |
| Distribution | Play Store + APK sideload for offline schools |

## Screen inventory

| # | Screen | Roles | Offline |
|---|---|---|---|
| S-01 | Login (QR / biometric) | All | Yes (last user) |
| S-02 | Dashboard | All | Yes |
| S-03 | Notifications | All | Yes |
| S-04 | Attendance QR scanner | Teacher, security, nurse | Yes (queue) |
| S-05 | Grades | Student, parent, teacher | Yes |
| S-06 | Class schedule | Student, teacher, parent | Yes |
| S-07 | Messenger | Parent, teacher, staff | No (online only) |
| S-08 | Profile | All | Yes |
| S-09 | Offline sync indicator | All | n/a |

## S-01 Login (QR / biometric)

```
┌──────────────────────────────┐
│ [Logo]  MeridianEd           │
│  School Management Ecosystem │
│                              │
│  ┌────────────────────────┐  │
│  │ [ Fingerprint ]  Sign  │  │
│  │  in with biometrics    │  │
│  └────────────────────────┘  │
│  or                          │
│  ┌────────────────────────┐  │
│  │ [ QR ]  Scan school QR │  │
│  └────────────────────────┘  │
│  Email  [user@school.ph]     │
│  Password [••••••••••]       │
│  ┌────────────────────────┐  │
│  │         LOG IN         │  │
│  └────────────────────────┘  │
│  Forgot? · Need help?        │
│  v1.4.2 · RA 10173 notice    │
└──────────────────────────────┘
```

Requirements: biometric unlock after first password login; QR login by scanning
a school-issued session QR (staff kiosk); offline allowed only for the most
recently authenticated user, with a grace window of 24 h; MFA prompts for
sensitive roles even on mobile.

## S-02 Dashboard

```
┌──────────────────────────────┐
│ 08:12  SY 2026-27 Q1      >> │
│ Good morning, T. Cruz        │
│ ┌─────────────┬────────────┐ │
│ │ 34 present  │ 2 absent   │ │
│ │ G7-Mabini   │ 1 late     │ │
│ └─────────────┴────────────┘ │
│ [Take attendance]  [Grades]  │
│ ┌──────────────────────────┐ │
│ │ ▶ Announcements (2 new)  │ │
│ │ PTA meeting Fri 4PM      │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Pending: 3 approvals · 1 │ │
│ │ unposted gradebook       │ │
│ └──────────────────────────┘ │
│ Profile  BELL 3  ☰ More     │
│      [● synced 08:10]        │
└──────────────────────────────┘
```

Role-aware content: teacher sees class summaries; parent sees learner cards
(attendance, next payment, new grades); student sees schedule and grades;
principal sees school KPIs. All tiles cached for offline reading.

## S-03 Notifications

```
┌──────────────────────────────┐
│ ← Notifications      [Mark]  │
│ Unread (3) · All · Sent      │
│ ┌──────────────────────────┐ │
│ │● 08:12 Absence: Reyes, A │ │
│ │  recorded absent period 2│ │
│ │   (parent view)          │ │
│ ├──────────────────────────┤ │
│ │● 08:00 Payment confirmed │ │
│ │  GCash ₱300 · SOA #214   │ │
│ ├──────────────────────────┤ │
│ │● 07:55 New grade posted  │ │
│ │  Math Q1 written work 20 │ │
│ ├──────────────────────────┤ │
│ │○ 08-09 PTA meeting memo  │ │
│ └──────────────────────────┘ │
│ [Retry sync] Pending: 0      │
└──────────────────────────────┘
```

Push via FCM with deep links; unread badge count shared with dashboard; messages
cache locally so history is readable offline; opt-out per channel respected from
the server.

## S-04 Attendance QR scanner

```
┌──────────────────────────────┐
│ ← Attendance   G7-Mabini     │
│ Period 1 · 08:15 AM          │
│ ┌──────────────────────────┐ │
│ │      ▢▢▢▢▢▢▢▢▢▢▢▢▢▢     │ │
│ │      ▢  [QR SCAN]  ▢     │ │
│ │      ▢▢▢▢▢▢▢▢▢▢▢▢▢▢     │ │
│ └──────────────────────────┘ │
│ [QR] [RFID/NFC] [Face] [Man] │
│ ✓ Reyes, Ana M.   08:15      │
│ ✓ Santos, B.      08:15      │
│ ✗ Unrecognized scan 08:15    │
│ ┌───────────┬──────────────┐ │
│ │ Present 34│ Absent 2     │ │
│ └───────────┴──────────────┘ │
│ [◉ 12 queued] [End session] │
└──────────────────────────────┘
```

Offline behavior: every scan writes to the local queue with a UUID key; on
connectivity the queue syncs in order with dedupe; teacher can end the session
and sync later. Duplicate scans within a configurable window (default 5 min) are
flagged, not recorded. RFID/NFC requires hardware with a reader; fallback to QR
or manual entry.

## S-05 Grades

```
┌──────────────────────────────┐
│ ← Grades  Math 7 · Q1        │
│ Ana Marie D. Reyes           │
│ ┌──────────────────────────┐ │
│ │ Written Work      avg 21 │ │
│ │ ████████████░░░░  Q1     │ │
│ │ Performance      avg 20  │ │
│ │ ████████████░░░░  Q1     │ │
│ │ Quarterly 42/50           │ │
│ │ Transmuted grade: 89     │ │
│ └──────────────────────────┘ │
│ [Details] [Comment by T.]   │
│ Term average: 87 (With       │
│ Honors range)                │
│ [SF9 preview]                │
└──────────────────────────────┘
```

Student/parent view is read-only; teacher view adds entry fields and draft state.
Grades render from cached gradebooks; SF9 preview requires sync (or queued
request).

## S-06 Class schedule

```
┌──────────────────────────────┐
│ ← Schedule  G7-Mabini        │
│ Mon ▸ Tue Wed Thu Fri        │
│ ┌──────────────────────────┐ │
│ │ 7:30   Homeroom · Rm 101 │ │
│ │ 8:00   Math · T. Cruz    │ │
│ │ 9:00   Filipino · Rm 102 │ │
│ │ 10:00  English · Rm 103  │ │
│ │ 11:00  Recess            │ │
│ │ 12:00  Science · Lab 1   │ │
│ └──────────────────────────┘ │
│ [This week] [Exam schedule] │
│ Offline: cached for 7 days  │
└──────────────────────────────┘
```

Week strip with period list; room changes push via notification and update the
cache; teacher sees load across sections; Chromebook layout shows two panes
(week grid + detail).

## S-07 Messenger

```
┌──────────────────────────────┐
│ ← Chats                      │
│ [Search]                     │
│ ┌──────────────────────────┐ │
│ │ Reyes (M) · ok po, salamat│ │
│ │ Santos (M) · meeting?     │ │
│ │ PTA G7 group · 3 msgs    │ │
│ └──────────────────────────┘ │
│ + New message                │
│ [Parent-teacher thread view] │
│ Message templates: [Reminder]│
│ [Excuse] [Permission slip]   │
│ ! Requires connection        │
└──────────────────────────────┘
```

Messenger is online-only: drafts compose offline and send on reconnect.
Templates (reminder, permission slip, excuse note) speed up common messages;
all messages audit-logged and subject to RBAC (parent ↔ adviser scope).

## S-08 Profile

```
┌──────────────────────────────┐
│ ← Profile                    │
│  ┌────────────────────────┐  │
│  │        [photo]         │  │
│  │  T. Juan C. Cruz       │  │
│  │  Teacher · G7 Adviser  │  │
│  └────────────────────────┘  │
│ Name / Contact / Password    │
│ [Edit contact]               │
│ Security:                    │
│  [x] Biometric unlock        │
│  [x] 2FA (TOTP)              │
│ Notifications:               │
│  [x] Push  [x] Email  [ ] SMS│
│ App: [Theme] [Language: EN]  │
│ [Fil] · [Sync now]           │
│ Data: [Export my data]       │
│ [Sign out]                   │
│ App version 1.4.2 · RA 10173 │
└──────────────────────────────┘
```

Self-service edits sync on next connection; export my data returns a
personally scoped, machine-readable file; sign-out clears cached learner data
from the device (privacy requirement).

## S-09 Offline sync indicator

The sync status is a persistent, tappable chip (topbar and dashboard) with
three states:

```
● Synced 08:12         → all queues empty, last successful sync time
◌ 12 pending · Syncing  → spinner while uploading outbox
! Offline · 87 queued   → no connectivity; queued writes count
```

Tapping opens the sync detail sheet: per-queue counts (attendance, grades,
messages, payments), last error, retry now button, and estimated data usage.
A full sync banner appears when background sync is throttled by the OS.

## Cross-cutting Android behaviors

| Behavior | Specification |
|---|---|
| Background sync | WorkManager with network and battery constraints; batch upload (≤ 500 records); exponential backoff; resumable chunking |
| Widgets | Home-screen widgets: attendance today (teacher), learner grades (parent), pending approvals (principal); refresh ≤ 30 min or on push |
| Biometrics | BiometricPrompt for unlock; Keystore-backed key; MUST NOT transmit biometrics — server auth stays password/MFA |
| NFC/RFID | Read student card ID (ISO 14443A/B, 15693); map to learner via cached directory; fallback QR/manual |
| Push | FCM with data payload for offline caching; per-channel opt-outs enforced server-side |
| Storage | App data ≤ 200 MB cache cap; automatic eviction of least-recent assets; school archive exports excluded from cap |
| Tablet/Chromebook | Adaptive NavigationRail/Scaffold; landscape layouts; Chromebook keyboard navigation and windowed mode |
| Security | App uses scoped storage; no sensitive data in SharedPreferences plaintext; encrypted shared prefs for tokens; PIN fallback if biometrics unavailable |

## MVP vs vision

| Item | MVP (Capacitor web shell) | Vision (Flutter 3) |
|---|---|---|
| Login | Password + QR | + Biometric, offline grace window |
| Attendance | Web scanner in browser shell | Native QR/RFID/NFC/face, offline queue |
| Offline | Read cache; limited writes | Full offline-first outbox with delta sync |
| Widgets | None | Home-screen widgets |
| Push | Web push where supported | FCM native push with deep links |
| Distribution | APK sideload | Play Store + sideload |

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable 11 of 30.*
