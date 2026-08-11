# Database Migration Plan

MeridianEd is a secure, cloud-native, AI-powered, mobile-first school management
ecosystem that centralizes academic, administrative, financial, HR, health,
guidance, research, and operational data for elementary schools, junior/senior
high schools, colleges, universities, school divisions, and regional offices.
This document defines how schema changes move from the working tree to
production: tooling, file naming, forward/rollback policy, zero-downtime
patterns, environment promotion, smoke tests, rollback, and the PostgreSQL PITR
interaction. MeridianEd is a placeholder brand — the name is rebrandable at any
time.

> **MVP note**: the MVP already ships versioned SQL in `../database/migrations/`
> run by a small runner in `server/`; the plan below formalizes that runner into
> the production toolchain.

## 1. Tooling strategy

| Concern | Choice | Rationale |
|---|---|---|
| Format | Numbered plain-SQL files, one per change | Tool-agnostic, diffable, reviewable in PRs |
| Runner (MVP) | Minimal runner in `server/` (like a hand-rolled Flyway) | Zero extra dependencies; records in `schema_migrations` |
| Runner (production) | Sqitch (preferred) or Flyway in CI | Dependency graph, checksums, repeatable `revert` for dev |
| Tracking | `schema_migrations` table (version, name, checksum, applied_at) | Applied-state truth; runner MUST verify checksums |
| Dialect | PostgreSQL 16 first-class; SQLite fallback for local dev only | MVP `node:sqlite` parity; production always PostgreSQL |

Migration SQL MUST be written in PostgreSQL dialect; the SQLite fallback
mirrors it manually and is verified by tests, never used in production.

## 2. File naming

Files live in `../database/migrations/` and MUST follow:

```
NNNN_description.sql
```

Rules:

- `NNNN` is a zero-padded, strictly increasing number (0001, 0002, ...). Never
  reuse or renumber; gaps are allowed after a revert in dev.
- `description` is snake_case, past tense verb + noun (`add_grades_quarter`,
  `create_student_guardians`).
- One logical change per file. Data backfills that belong to a schema change
  MUST live in the same file (atomic with it).
- Never edit an applied migration. Corrections are new migrations.

## 3. Forward/rollback policy

- **Forward-only in shared environments** (staging, prod): every change is an
  additive forward migration. Destructive operations (`DROP`, renames) are
  never run in place; they follow expand-contract (Section 4).
- **Dev only**: Sqitch `revert` and `reset` are allowed before the change ships.
- **Checksums**: the runner MUST verify the checksum of every applied migration
  and fail loudly on drift; a mismatch stops the deploy before app rollout.
- **Transactional**: DDL in PostgreSQL is transactional; each migration MUST
  wrap in `BEGIN; ... COMMIT;` so a failed migration rolls back cleanly.

## 4. Zero-downtime change patterns

All production changes MUST be deployable without stopping the API (99.9% SLO).

| Pattern | When | How |
|---|---|---|
| Additive (safe) | New tables, columns, indexes, types | Plain `CREATE`/`ALTER ... ADD COLUMN` (nullable or defaulted) |
| Expand-contract | Rename, retype, add NOT NULL | 1) add new column; 2) backfill; 3) dual-write in app; 4) cut over; 5) drop old in a later migration |
| Backfill | Populating new columns | Batched `UPDATE ... LIMIT` loops with progress logging; never a single unbounded UPDATE |
| Dual-write | Column replaces another | App writes both for one release; read path switches after backfill verification |
| Index creation | Large tables | `CREATE INDEX CONCURRENTLY` (non-transactional; run outside the migration transaction) |
| NOT NULL without downtime | Tightening | Add as nullable → backfill → `ALTER COLUMN SET NOT NULL` in a later window |
| Constraint additions | FK/CHECK | `ADD CONSTRAINT ... NOT VALID` then `VALIDATE CONSTRAINT` to avoid full-table locks |

## 5. Environment promotion

The same artifact (the migration directory at a tagged commit) is promoted
dev → staging → prod:

1. **dev**: `revert` allowed, applied on every server start (MVP) or CI run.
2. **staging**: forward-only; runs a full restore of an anonymized prod
   snapshot first, then applies migrations and the full smoke suite.
3. **prod**: forward-only, executed by CI (Deliverable 21) before the new app
   version rolls out; zero-downtime patterns keep reads/writes live.

Ordering rule: **migrations apply before app rollout**, and the app version
MUST be compatible with the previous schema for one release (expand/dual-write
contract). Rollbacks of the app are always safe; schema is forward-only.

## 6. Smoke tests after migration

Every migration set MUST pass, in order:

1. Runner reports `N applied, 0 failed, all checksums match`.
2. Key queries run: one representative SELECT per new table/column (row counts,
   sample rows, no exceptions).
3. Integrity checks: orphan-FK scan, duplicate detection on new UNIQUE columns,
   `NOT NULL` verification.
4. Index checks: `EXPLAIN` on the top queries per module confirms the new
   indexes are used (no seq scans on hot paths).
5. Critical workflows: login, list students, enter a grade, view attendance —
   against the migrated schema.
6. Performance gate: migration duration and deadlock/blocking counters recorded
   (Grafana alert if `lock_time` spikes).

Failures block the release; the DB team owns the fix as a new forward
migration, never an edit of the shipped one.

## 7. Rollback plan

| Case | Action |
|---|---|
| Migration fails mid-transaction | Automatic `ROLLBACK`; fix and ship a new migration |
| Migration succeeds, app rollout fails | Roll back the app only; schema stays (additive changes are harmless) |
| Data corruption or bad backfill discovered post-deploy | Evaluate PITR restore (below) vs. corrective forward migration; prefer corrective migration when possible |
| Emergency schema undo in dev/staging | Sqitch `revert NNNN` |

Production rollback is **not** `DROP`; it is a new forward migration plus, when
necessary, point-in-time recovery of affected rows.

## 8. PostgreSQL PITR note

- WAL archiving runs continuously (RPO <= 15 min), so a migration window can be
  recovered to any instant before or after it — including reverting a
  committed-but-wrong migration by restoring the pre-migration LSN and replaying
  the correct path.
- PITR retention (7 days) covers audit-compliance requirements (RA 10173) and
  gives a week-long rollback horizon; nightly snapshots add a second layer
  (Deliverable 19).
- Cross-region replicas follow the same WAL stream; the DR runbook
  (Deliverable 20) includes "restore to just before migration NNNN" as a
  standard procedure.

## 9. Example migration skeletons

### 9.1 Expand-contract example

```sql
-- 0021_expand_enrollments_grade_band.sql
-- Contract: add nullable grade_band, backfill from sections, dual-write in app.
-- 0022 will set NOT NULL after cutover; 0023 will drop the old column.
BEGIN;

ALTER TABLE enrollments ADD COLUMN grade_band VARCHAR(10);

UPDATE enrollments e
SET grade_band = CASE
    WHEN s.grade_level BETWEEN 1 AND 3 THEN '1-3'
    WHEN s.grade_level BETWEEN 4 AND 6 THEN '4-6'
    WHEN s.grade_level BETWEEN 7 AND 10 THEN 'JHS'
    ELSE 'SHS'
END
FROM sections s
WHERE s.id = e.section_id
  AND e.grade_band IS NULL
LIMIT 5000;  -- repeatable batched backfill; run by the worker loop

COMMIT;
```

### 9.2 Trigger for audit parity example

```sql
-- 0035_add_notifications_audit_trigger.sql
-- Forward-only: every read-mark of a notification is audited.
BEGIN;

CREATE FUNCTION notifications_audit() RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_logs (user_id, tenant_id, action, entity, entity_id,
                          old_values, new_values)
  VALUES (NEW.user_id, NEW.tenant_id, 'notification.read',
          'notifications', NEW.id::text,
          row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notifications_audit
  AFTER UPDATE ON notifications
  FOR EACH ROW
  WHEN (OLD.read_at IS NULL AND NEW.read_at IS NOT NULL)
  EXECUTE FUNCTION notifications_audit();

COMMIT;
```

## 10. Responsibilities

- Developers: write forward migrations with rollback-aware, batched backfills.
- CI/CD: run staging migrations + smoke tests; gate prod deploys (Deliverable 21).
- DB owner (ICT role): approves lock-bearing migrations and PITR decisions.
- Documentation: each migration ships with a one-line entry in the changelog
  in `docs/` so the schema reference (Deliverable 9) stays current.

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable 25 of 30.*
