# Backup Strategy

This document describes the backup system **as actually built** for the
Hinabangan NHS system. It replaces the earlier aspirational GCP/Cloud SQL
write-up, which described infrastructure the project does not use.

## 1. What the system runs on

| Layer | Production | Local dev |
|---|---|---|
| Database | PostgreSQL 16 on Neon (`DATABASE_URL`) | Node built-in SQLite (`server/data/meridianed.db`, WAL mode) |
| Web service | Render (free tier, in-process jobs only) | `npm run dev` |
| Object storage | Cloudflare R2 (`R2_*` env vars) | None (local disk) |

Because Render's free tier has **no cron-scheduled worker** and its disk is
**ephemeral** (wiped on redeploy), the backup job runs **inside the API process**
(like the existing notification and storage-retention sweeps) and writes to
**both** local disk and the R2 bucket. The R2 copy is what survives redeploys.

## 2. The backup mechanism

- Backup logic lives in `server/src/backup.js`; the CLI in `server/scripts/backup.js`;
  the scheduled job in `server/src/backup-sweep.js` (started from `server/src/index.js`).
- A "backup" is a compressed logical dump: one JSON file containing every table's
  column list and row data, gzipped. Format `meridianed-dump` v1.
- **Consistency:** PostgreSQL dumps run inside a single `SERIALIZABLE READ ONLY`
  transaction, so every table is read from one snapshot. SQLite uses
  `VACUUM INTO` (a plain file copy is NOT safe because the app runs in WAL
  mode — the base `.db` can lag committed writes).
- **Fidelity:** `date` and `numeric` columns are dumped as text so their exact
  value survives the JSON round trip; explicit ids are preserved (so foreign
  keys keep pointing at the same rows); inserts are ordered by foreign-key
  dependency; and PG sequences are advanced past the restored rows so the app
  does not collide on the next insert.
- Backup file: `meridianed-<timestamp>.json.gz`. Local folder `BACKUP_DIR`
  (default `<DATA_DIR>/backups`); R2 prefix `BACKUP_R2_PREFIX`
  (default `backups/meridianed`).

## 3. Schedule (automatic)

Enable with `BACKUP_ENABLED=1` on the server (production and/or dev):

| Env var | Default | Meaning |
|---|---|---|
| `BACKUP_ENABLED` | off | Runs the first backup at boot, then every `BACKUP_INTERVAL_HOURS` |
| `BACKUP_INTERVAL_HOURS` | 24 | Backup cadence |
| `BACKUP_RETAIN` | 5 | Newest N backups kept locally and in R2 (older ones pruned) |
| `BACKUP_DIR` | `<DATA_DIR>/backups` | Local destination |
| `BACKUP_R2_PREFIX` | `backups/meridianed` | R2 key prefix |
| `BACKUP_DRILL_ENABLED` | off | Also run a full restore drill after each backup |

Manual runs: `npm run backup` (create now), `npm run backup:list`,
`npm run backup:drill`, `npm run backup:cleanup [N]`.

## 4. Restore and restore drills

- **Drill (verifies backups actually restore):** `npm run backup:drill` takes the
  newest local backup, rebuilds its schema in an isolated throwaway PG schema
  (or temp SQLite file) by replaying the migrations, restores the rows there,
  re-dumps, and diff-every-table against the original. It prints
  `RESTORE DRILL PASS` / `FAIL`. Set `BACKUP_DRILL_ENABLED=1` to run it
  automatically after every scheduled backup. This was exercised and passing
  against both a real Postgres 16 server and the app's SQLite database in
  development.
- **Real restore:** `node scripts/backup.js --restore FILE --yes`
  (add `--bootstrap` to build the schema from migrations first, for a fresh
  target database). Restoration always replaces the dump's tables — run it with
  the server stopped. Restore + `npm run backup:drill` together confirm the
  restored data is intact.

## 5. Retention

`BACKUP_RETAIN` (default 5) keeps the newest N files, pruned oldest-first from
both the local folder and R2 after every successful backup. For a school
records system, consider raising to 14 (two weeks of daily backups) once you
confirm storage budget on the free tiers.

## 6. Monitoring

Every backup event is logged through the app's pino logger: dialect, file,
tables, rows, size, R2 key, duration. Failures are logged as errors and, if a
Sentry DSN is configured, would flow there with other app errors. There is no
separate paging — the owner watches the logs (Render log stream).

## 7. Honest RPO/RTO

- **RPO** = the backup interval (24 h by default; tighten with
  `BACKUP_INTERVAL_HOURS`). A crash can lose up to the last 24 h of records.
- **RTO** = however long a manual restore takes on a fresh database
  (minutes for this data volume), plus any re-pointing of `DATABASE_URL`.
- Neon's free tier keeps a limited built-in history. If the school moves to a
  paid Neon plan, enable Neon's point-in-time recovery as a **complement** to
  these dumps to shrink RPO; the dump files in R2 remain the portable,
  provider-independent safety net.

## 8. What is NOT backed up here

- Uploaded files live in R2 (object storage), not the database. Enabling bucket
  **versioning** in the Cloudflare dashboard is cheap insurance against
  accidental deletes/overwrites and is recommended.
- E-mail/SMS/FCM push queues are re-derivable state, not backed up.