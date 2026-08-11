# Security Architecture

MeridianEd is a secure, cloud-native, AI-powered, mobile-first school management
ecosystem that centralizes academic, administrative, financial, HR, health,
guidance, research, and operational data for elementary schools, junior/senior
high schools, colleges, universities, school divisions, and regional offices.
This deliverable defines the security architecture for that ecosystem: threat
model, defense-in-depth layers, IAM/RBAC, authentication, API hardening, audit
logging, and RA 10173 (Philippine Data Privacy Act) compliance mapping. The
architecture is GCP-based with AWS/Azure equivalents noted where natural (Cloud
KMS → AWS KMS/Azure Key Vault). The MVP shares the same principles at a smaller
scale; production controls below are vision-level.

> MeridianEd is a placeholder brand — the name is rebrandable at any time.

## 1. Trust model and principles

- Zero trust: no implicit trust by network location; every request is
  authenticated, authorized, and scoped to the user's tree node
  (region → division → school → section).
- Least privilege: RBAC + row-level tenant scoping; `super_admin` is the only
  cross-tenant role.
- Defense in depth: controls at network, transport, application, data, and
  identity layers.
- Key default numbers: availability 99.9%; JWT access 15 min + refresh
  14 days (rotation, revocation); passwords ≥ 12 chars, 90-day expiry,
  5 failed attempts → 15-min lockout; audit logs retained 7 years.

## 2. Threat model (STRIDE)

| Asset | S (Spoofing) | T (Tampering) | R (Repudiation) | I (Info disclosure) | D (DoS) | E (Elevation) |
|---|---|---|---|---|---|---|
| Student PII (LRN, address, PS documents) | Fake learner intake | Grade/record alteration | Learner denies record changes | Bulk export exfiltration | Search/export exhaustion | Student PII readable across schools |
| Grades / class records | Teacher account takeover | Score inflation/deflation | Teacher denies entry | Unauthorized report access | Report generation flood | Section/level cross-read |
| Payroll / HR data | Impersonated `hr` admin | Payroll figure edits | Manager denies approval | Payslip leakage | Report spam | Payroll visible school-wide |
| Health records (clinic) | Impersonated `nurse` | Treatment log edits | Nurse denies entries | Medical data exposure | Upload flood | Health data cross-school read |
| Payment data (billing) | Forged provider callback | Ledger credit forgery | Cashier denies collection | Account/billing leakage | Checkout abuse | Cashier sees other schools |

Controls per row are in Sections 3–10; every listed threat maps to at least one
layer (network, identity, application, data) and one audit event.

## 3. Security layers (defense in depth)

| Layer | Control | Implementation |
|---|---|---|
| Network | Firewall + DDoS | GCP VPC, Cloud Load Balancing, Cloud Armor (L3/L7 WAF, rate limits, geo fencing for admin routes); AWS/Azure equivalents: Shield/WAF + Front Door |
| Transport | TLS 1.3 end-to-end | Managed certs at LB, HSTS, no plaintext traffic; Android app enforces certificate pinning (public-key pin set per environment) |
| Application | WAF, input validation, ORM | Cloud Armor managed rules; NestJS `class-validator` DTOs; parameterized queries only; CSP + `SameSite=Lax/Strict` cookies |
| Identity | Keycloak OIDC + MFA | Federation via Google/Microsoft/DepEd; TOTP/WebAuthn MFA for staff |
| Data | AES-256 at rest, envelope encryption | Cloud SQL + Cloud Storage encrypted with CMEK via Cloud KMS; envelope: DEK per object/row wrapped by KEK |
| Key rotation | KMS key rotation | Automatic rotation 30 days (KEK); DEK re-wrap on rotation; rotation window monitored |

## 4. IAM & RBAC permission matrix

Permission codes: A = admin (full scope within tree node), W = write, R = read,
— = no access. Rows are the canonical roles; columns are consolidated modules
(SIS, Academic, Attendance, Finance, Clinic, Guidance, HR, Library, Property,
Reports, System Admin).

| Role | SIS | Academic | Attendance | Finance | Clinic | Guidance | HR | Library | Property | Reports | System |
|---|---|---|---|---|---|---|---|---|---|---|---|
| super_admin | A | A | A | A | A | A | A | A | A | A | A |
| region_admin | A | A | A | R | R | R | R | R | R | A | A |
| division_admin | A | A | A | R | R | R | R | R | R | A | A |
| school_admin | A | A | A | W | W | W | W | W | W | A | A |
| principal | R | W | A | R | R | R | R | R | R | A | — |
| assistant_principal | R | W | W | — | R | R | — | R | — | W | — |
| registrar | A | R | R | — | — | — | — | — | — | W | — |
| teacher | R | W | W | — | — | — | — | — | — | R | — |
| guidance | R | — | R | — | — | A | — | — | — | R | — |
| nurse | R | — | R | — | A | — | — | — | — | R | — |
| librarian | R | — | — | — | — | — | — | A | — | R | — |
| cashier | R | — | — | W | — | — | — | — | — | W | — |
| accounting | R | — | — | A | — | — | — | — | — | W | — |
| hr | R | — | W | R | — | — | A | — | — | W | — |
| property_custodian | — | — | — | — | — | — | — | — | A | R | — |
| ict | R | R | R | R | R | R | R | R | R | R | W |
| security | R | R | R | — | — | — | — | — | — | R | R |
| student | R | R | — | R | — | — | — | — | — | R | — |
| parent | R | R | — | R | — | — | — | — | — | R | — |

Row-level tenant scoping is enforced at the database layer: every query carries
the user's region/division/school/section scope, so a `teacher` at one school
can never read another school's records even with a W/R bit.

## 5. Authentication and session management

| Control | Policy |
|---|---|
| MFA | Required for all staff roles at first login and every 30 days; TOTP app or WebAuthn hardware key; `student`/`parent` MAY opt in |
| Access token | JWT, 15-min expiry, signed by Keycloak, audience-bound to API |
| Refresh token | 14 days, rotating (each use issues a new token), revoked on password change, logout, or suspicious-device event |
| Device registration | First login from a new device requires email OTP verification; device bound to refresh token; max 5 active devices per user |
| Login history | Every login recorded immutably (IP, user agent, device, result); visible to the user and to `school_admin` for staff |
| Account lockout | 5 failed attempts → 15-minute lock; lockout events alert `ict`/`security` |
| Password policy | ≥ 12 chars, complexity, 90-day expiry, no reuse of last 5, breached-password check at set time |
| Idle timeout | 15 minutes idle on web; mobile requires re-auth on unlock after 1 hour |

## 6. SSO federation

- Google and Microsoft: OIDC federation in Keycloak for staff who have school
  Google/M365 accounts; accounts still carry MeridianEd roles.
- DepEd: federation with DepEd accounts where the Division provides OIDC/SAML
  identity; otherwise local accounts. Provisioning via SCIM from HR module.
- All federated identities inherit the same MFA and lockout policies.

## 7. API security

| Control | Policy |
|---|---|
| JWT validation | Signature, issuer, audience, expiry checked on every request; introspection for refresh flows |
| Rate limiting | Per-user and per-IP buckets: auth 5/min, general API 60/min, exports 3/hour; 429 responses honored |
| Input validation | Strongly typed DTOs; length/format bounds; LRN validated as 12 digits |
| SQL injection | Parameterized queries / ORM only; no string-concatenated SQL; e2e tests include injection probes |
| XSS | CSP, output encoding, `X-Content-Type-Options: nosniff`, React 19 escapes by default |
| CSRF | `SameSite` cookies + double-submit tokens on state-changing endpoints |
| CORS | Allow-list of portal origins only; no wildcard with credentials |
| Secrets | No secrets in code; Secret Manager injection at runtime |

### OWASP Top 10 checklist

| # | Category | MeridianEd control |
|---|---|---|
| A01 | Broken Access Control | RBAC matrix + row-level scoping; deny-by-default |
| A02 | Cryptographic Failures | TLS 1.3, AES-256 at rest, KMS envelope encryption |
| A03 | Injection | ORM + validation; WAF rules |
| A04 | Insecure Design | Threat model per asset; secure design review at DR |
| A05 | Security Misconfiguration | IaC scanning (Trivy/Terraform validate), CIS benchmarks |
| A06 | Vulnerable Components | SBOM + dependency audit in CI; 30-day patching SLA |
| A07 | ID and Auth Failures | Keycloak, MFA, lockout, rotation |
| A08 | Software and Data Integrity | Signed containers, provenance, signed callbacks (GCash/Maya) |
| A09 | Logging and Monitoring Failures | Immutable audit log + alerts (Section 9) |
| A10 | SSRF | Egress allow-lists, no user-supplied URLs in server requests |

## 8. Audit and immutable logs

- Append-only, WORM-object storage (Cloud Storage lock/retention policy
  equivalent); application-level audit events cannot be modified or deleted.
- Events: logins, role changes, grade submissions, enrollment changes, billing
  mutations, payroll changes, health-record edits, report certifications.
- Retention: 7 years (DepEd records + RA 10173), then cryptographic erasure
  (KEK delete). Logs are cryptographically hashed in a chain (hash of previous
  event) to detect tampering.

## 9. RA 10173 compliance mapping

| DPA obligation | MeridianEd implementation |
|---|---|
| Privacy notice | Shown at registration, enrollment, and payment; per-purpose notices stored with consent records |
| Consent | Explicit, per-purpose consent captured and versioned; withdrawal honored within 24 h |
| Data subject rights (access, correction, erasure, portability, objection) | Self-service portal + API; PII erasure workflow; automated data-subject export |
| Security of personal data | Sections 3–8 of this document; annual third-party security audit |
| Breach notification | Notification to NPC and affected data subjects within 72 hours of confirmed breach; internal escalation < 1 hour |
| DPO appointment | Designated Data Protection Officer with `security` visibility and incident role |
| NPC registration | Register Data Processing Systems with National Privacy Commission; renewal per NPC rules |
| Cross-border transfer | Data residency in Philippines region; no transfers outside registered purposes |

## 10. Breach response summary

Detection → triage (≤ 1 h) → containment (≤ 4 h) → NPC/data-subject notification
(≤ 72 h) → root cause → post-incident review. Full runbook in
[20-disaster-recovery.md](20-disaster-recovery.md) (ransomware/corruption
scenario) and [21-devops-pipeline.md](21-devops-pipeline.md) (incident
management).

---
*MeridianEd — Cloud-Based School Management Ecosystem — Deliverable 17 of 30.*
