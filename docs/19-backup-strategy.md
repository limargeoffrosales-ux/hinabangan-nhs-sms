# Backup Strategy

MeridianEd is a secure, cloud-native, AI-powered, mobile-first school management
ecosystem that centralizes academic, administrative, financial, HR, health,
guidance, research, and operational data for elementary schools, junior/senior
high schools, colleges, universities, school divisions, and regional offices.
This deliverable defines the backup strategy that underpins the platform SLOs:
RPO ≤ 15 minutes, RTO ≤ 4 hours (region failover), and RTO ≤ 15 minutes for
database HA. Backups are encrypted, versioned, monitored, and proven by
scheduled restore drills. The strategy is GCP-native (Cloud SQL backups +
PITR, Cloud Storage, Cloud KMS); AWS/Azure equivalents are Cloud SQL → RDS and
Storage → S3/Azure Blob. The MVP uses the same principles with local
`node:sqlite` files and a nightly dump.

> MeridianEd is a placeholder brand — the name is rebrandable at any time.

## 1. Backup matrix

| Data / system | Backed up? | Method | Frequency | Owner |
|---|---|---|---|---|
| PostgreSQL 16 (Cloud SQL) | Yes | Automated full backups + continuous WAL archiving (PITR) | Full daily, WAL continuous | DB admin |
| Cloud Storage objects (SF exports, media, receipts) | Yes | Object versioning + multi-region replication | Continuous | Platform team |
| Keycloak realm config + users | Yes | Export to bucket, included in IaC | On change + daily | Platform team |
| Terraform state / IaC | Yes | Git history + state bucket versioning | On change | Platform team |
| Secrets (Secret Manager) | Yes | Secret Manager versioning (no copy to buckets) | On change | Platform team |
| Audit logs (7-year retention) | Yes | WORM bucket + long-term archive class | Continuous | Platform team |
| Source code | Yes | Git (GitHub) with branch protection | On commit | Dev team |
| Redis 7 cache | No (reconstructible) | Rebuild from DB on restart | — | — |
| Stateless containers / Cloud Run revisions | No | Redeployed from image registry | — | — |
| Temp files, local uploads in pods | No | Ephemeral by design | — | — |

## 2. Backup types

### 2.1 Continuous WAL archiving (PITR)

- Cloud SQL writes WAL segments continuously to storage; point-in-time recovery
  restores to any second within the retention window.
- Achieves RPO ≤ 15 minutes (in practice seconds); the recovery target is
  validated monthly.
- Equivalent on AWS/Azure: RDS automated backups + PITR, Azure SQL long-term
  retention.

### 2.2 Daily full + nightly snapshots

| Backup | Cadence | Retention | Purpose |
|---|---|---|---|
| Daily full backup | 01:00 Asia/Manila | 30 days | Baseline for restore |
| Weekly full | Sunday 01:00 | 90 days | Mid-term recovery |
| Monthly full | 1st of month 01:00 | 12 months | Long-term recovery |
| Nightly snapshot (project files, media) | 02:00 Asia/Manila | 30 days | Object-state baseline |

## 3. Object storage lifecycle

- Versioning enabled on all business buckets; accidental delete/overwrite is
  recoverable via prior version.
- Multi-region replication: primary (asia-southeast1) mirrored to secondary
  region bucket for DR (see [20-disaster-recovery.md](20-disaster-recovery.md)).
- Lifecycle rules: transient data → nearline after 30 days, coldline after 90
  days, archive after 1 year; audit logs move to archive class at 1 year and
  are retained 7 years before erasure.
- Media uploads follow the same lifecycle; SF exports and receipts are
  versioned indefinitely within retention.

## 4. Encryption of backups

- All backups and WAL segments are encrypted with CMEK via Cloud KMS
  (AES-256) before leaving the DB; backups in Cloud Storage inherit
  bucket-level CMEK.
- Key hierarchy: backup DEKs are wrapped by the backup KEK; KEK rotation
  (30 days) does not re-encrypt data — new keys apply to new writes.
- Restore requires both the backup and KEK access; KEK deletion (erasure)
  renders the backup unrecoverable, used for DPA erasure.

## 5. Backup verification and restore testing

| Drill | Frequency | Scope | Success criteria |
|---|---|---|---|
| PITR recovery drill | Monthly | Restore DB to 5 min before a synthetic incident in staging | Restore completes < 4 h; data consistent |
| Full restore drill | Quarterly | Full restore of DB + object storage into isolated test project | All data present, checksums match, portal runnable |
| Object restore drill | Quarterly | Restore one versioned object, one deleted object | Version recovered intact |
| Failover drill (HA) | Quarterly | Promote replica, fail back | RTO ≤ 15 min DB HA |
| Region failover drill | Annually | Full DR exercise (see 20-disaster-recovery.md) | RTO ≤ 4 h, RPO ≤ 15 min |

Drill results are recorded with evidence (timestamps, checksums) and reported
to the DR lead; failed drills open corrective tickets with a 30-day SLA.

## 6. Retention policy

| Data | Retention | Disposal |
|---|---|---|
| Audit logs (immutable) | 7 years | KEK deletion → erasure |
| DB full backups | Daily 30 d / weekly 90 d / monthly 12 months | Lifecycle rule delete |
| WAL segments | Matches DB retention (support PITR ≥ 15 min RPO) | Lifecycle rule delete |
| Project files, media | 1 year, or school retention rule | Lifecycle rule delete |
| Deleted learner records (DPA) | Erasure on verified request; backups erased at lifecycle | KEK deletion |
| Terraform state | 7 years (as infrastructure record) | Bucket lifecycle |

Retention is enforced by storage lifecycle policies, not manual processes.
Any extension (e.g. legal hold for a DepEd dispute) is applied per-object via
hold policy and tracked.

## 7. Backup monitoring and alerts

| Alert | Threshold | Action |
|---|---|---|
| Backup job failed | Any failed full/automated backup | Page DB admin within 15 min; retry within 1 h |
| WAL lag | Lag > 15 min | Page DB admin; investigate replication/storage |
| Backup age | No successful backup in 26 h | Page DB admin; block risky deploys |
| Restore drill failure | Any failed criterion | Ticket + DR lead notified; retest in 30 days |
| Encryption/key error | KMS operation failed | Page platform team; verify KEK status |
| Storage lifecycle violation | Object older than retention limit | Audit + `security` review |

Alerts flow into Prometheus/Cloud Monitoring and Grafana dashboards; every
alert has an owner and an escalation path (see on-call in
[21-devops-pipeline.md](21-devops-pipeline.md)).

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable 19 of 30.*
