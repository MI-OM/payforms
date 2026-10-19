# Payforms Security Audit Report

**Date:** 2026-10-18  
**Auditor Role:** Senior Application Security Engineer / Database Security Architect  
**Scope:** Payforms monorepo — backend, frontend, database migrations, deployment configuration  
**Classification:** Confidential — Internal Use  

---

## 1. Executive Summary

Payforms is a multi-tenant financial management platform for educational institutions. Each tenant (school) is isolated from others at both the application and database layers through Row Level Security. The core concern raised by the prospective client — that the developer of Payforms could access a school's revenue information — is **partially justified by the current architecture**, but not fully. The facts are nuanced:

- **Cross-tenant isolation between schools is strongly implemented** through PostgreSQL Row Level Security with `FORCE ROW LEVEL SECURITY` on all financial tables.
- **The developer, however, retains the technical capability to access any school's financial data** through database credentials, deployment access, and the platform impersonation feature. These access paths are mitigated by audit logging and access controls, but they are not cryptographically prevented.
- **No application-level field encryption is in use.** Financial amounts, transaction records, and payment statuses are stored as plaintext in the database.
- **Four confirmed vulnerabilities were identified and remediated** during this audit, none of which caused demonstrated cross-tenant data leakage to application users.

**Overall classification: CONDITIONALLY READY**

---

## 2. Architecture Discovered

### 2.1 Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (React), deployed on Vercel |
| Backend | NestJS (Node.js + TypeScript), deployed on Render |
| Database | PostgreSQL (Supabase-hosted) accessed via TypeORM |
| Payment Provider | Paystack (per-organization secret keys stored in DB) |
| File Storage | Supabase Storage (S3-compatible) or AWS S3 |
| Cache | In-memory (default) or Redis |
| Email | SendGrid / Mailgun / Brevo |

### 2.2 Multi-Tenancy Model

Payforms is a **shared-database, shared-schema** multi-tenant architecture. All schools share a single Supabase/PostgreSQL project. Tenant isolation is enforced at two layers:

1. **Application layer:** Every service method receives an `organizationId` derived from the authenticated JWT. Queries always include `WHERE organization_id = :organizationId`.
2. **Database layer:** PostgreSQL Row Level Security policies on every financial table restrict rows to the organization set in the connection's `app.current_org_id` GUC, or allow bypass when `app.rls_bypass = 'on'`.

### 2.3 Authentication Architecture

Two completely separate authentication systems coexist:

**Tenant authentication** (`/auth/*`):
- JWT-based, signed with `JWT_SECRET`
- Token extracted from `Authorization: Bearer` header or `pf_access_token` HttpOnly cookie
- Refresh tokens hashed with bcrypt and stored in `users.refresh_token_hash`
- Optional TOTP-based 2FA with recovery codes
- Rate limiting: 5 login attempts per 60 seconds

**Platform admin authentication** (`/platform/auth/*`):
- JWT-based, signed with `PLATFORM_JWT_SECRET` (a different secret)
- Tokens use separate `pf_platform_*` cookies to prevent collision
- `is_platform_admin: true` marker in validated user object prevents platform tokens from being used against tenant endpoints
- Rate limiting: 5 login attempts per 60 seconds

### 2.4 RLS Architecture

The `RlsQueryRunnerPatcher` monkey-patches TypeORM's `DataSource.createQueryRunner()` so every SQL query is preceded by:

```sql
SELECT set_config('app.current_org_id', $1, false),
       set_config('app.rls_bypass',     $2, false)
```

The context values come from `OrganizationContextService` which uses Node's `AsyncLocalStorage` to store per-request tenant state. The `SetOrganizationContextInterceptor` populates this at the start of every HTTP request.

Database RLS policies are of the form:

```sql
USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR organization_id::text = NULLIF(current_setting('app.current_org_id', true), '')
)
```

`FORCE ROW LEVEL SECURITY` is applied, meaning the policies apply even to the table owner role.

### 2.5 Platform Impersonation

A `SUPER`-role platform admin can start an impersonation session targeting any organization and any user within it. This session:
- Requires a mandatory `reason` field
- Is recorded in the `impersonation_sessions` table with actor email, IP, user agent, and timestamps
- Mints a short-lived (configurable, max 480 minutes) tenant JWT that carries `impersonation.session_id`
- Is validated on every tenant API call — ending the session revokes the token immediately

**This feature gives a platform admin the same access as the targeted school admin.** This is by design for support purposes, but it is a confirmed path through which the developer can access financial data.

---

## 3. Data-Flow Overview

### Payment lifecycle

```
1. School admin creates a payment record (POST /payments)
   └─ Backend validates amount, checks submission belongs to same org
   └─ Sets status = PENDING, stores amount/reference in payments table

2. Customer initiates Paystack checkout (POST /public/payments/:id/initialize)
   └─ Backend uses org.paystack_secret_key to call Paystack API
   └─ Amount in kobo is read from the database record, not from the client
   └─ Callback URL is returned; browser is redirected to Paystack checkout

3. Paystack processes payment (Paystack servers, outside Payforms)
   └─ Money settles into school's own Paystack account

4. Paystack delivers webhook (POST /webhooks/paystack)
   └─ Raw body preserved; HMAC-SHA512 verified with timing-safe comparison [POST-FIX]
   └─ Signature matched against all org secret keys to identify organization
   └─ handleWebhookEvent() called with verified organizationId
   └─ applyPaystackOutcome() validates Paystack-reported amount >= expected [POST-FIX]
   └─ Payment status updated; payment_log record inserted

5. Frontend callback redirect (GET /public/payments/callback)
   └─ Backend re-verifies payment with Paystack API (server-side)
   └─ Status updated if Paystack confirms success

6. Reports and analytics
   └─ GET /reports/summary, /reports/analytics — scoped to req.user.organization_id
   └─ GET /transactions — scoped to req.user.organization_id
   └─ RLS provides secondary enforcement at the database layer
```

---

## 4. Sensitive Data Inventory

| Table | Sensitive Fields | RLS Protected |
|-------|-----------------|---------------|
| `payments` | `amount`, `total_amount`, `amount_paid`, `balance_due`, `status`, `reference`, `paid_at` | ✅ |
| `payment_logs` | Full Paystack webhook payloads (JSON) | ✅ |
| `submissions` | Form submission data | ✅ |
| `contacts` | Student names, email addresses, phone numbers | ✅ |
| `reconciliation_runs` | Payment reconciliation summaries | ✅ |
| `reconciliation_exceptions` | Payment discrepancy details | ✅ |
| `installment_plans` | Total amounts, per-item amounts, due dates | ✅ |
| `contact_installment_accounts` | Outstanding balances per student | ✅ |
| `compliance_export_artifacts` | File paths and checksums for exported financial data | ✅ |
| `organizations` | `paystack_secret_key`, `paystack_public_key`, billing tier | ❌ (no RLS — root tenant table) |

**No application-level encryption is applied to any field.**

---

## 5. Existing Encryption Mechanisms

### 5.1 Encryption at rest

Supabase-hosted PostgreSQL provides AES-256 encryption at rest for all stored data, including backups, as a baseline infrastructure service. This protects against unauthorized physical storage access.

**This does NOT prevent an authorized database administrator or a backend service with valid credentials from querying readable plaintext financial data.**

### 5.2 Encryption in transit

- All connections from the browser to the backend use HTTPS (enforced by Render/Vercel TLS).
- HSTS is enabled in production (`max-age=31536000; includeSubDomains; preload`).
- The database connection uses SSL when `DB_SSL=true` is configured. The TLS certificate is accepted without chain validation (`rejectUnauthorized: false`) due to the Supabase connection pooler presenting a certificate not in Node's default trust store. **This is a known limitation of managed Supabase pools and is documented in the code.**

### 5.3 Application-level encryption

**None.** No financial fields are encrypted at the application layer before insertion into the database. Amounts, references, and transaction statuses are stored as plaintext.

---

## 6. Authentication and Authorization Findings

### 6.1 Strengths

- Separate JWT secrets for tenant and platform admin tokens; tokens cannot be interchanged.
- `is_platform_admin: true` marker checked by `PlatformRolesGuard` prevents tenant JWTs from satisfying platform routes.
- Rate limiting on authentication endpoints (5 attempts per 60 seconds).
- HttpOnly secure cookies with `SameSite: none` in production.
- Refresh tokens stored as bcrypt hashes; raw token value is never retained.
- TOTP 2FA available for tenant users.
- Password validation enforced via `password-policy.ts`.
- Users can be soft-deleted (deactivated) by org admins.

### 6.2 Weaknesses

- `PLATFORM_JWT_SECRET` derives from `JWT_SECRET` when unset with a `::platform-admin` suffix. While the derived value is distinct, the documented warning must be enforced as a hard startup failure in production, not just a log line. Currently the application does not crash if `PLATFORM_JWT_SECRET` is missing in production.
- Swagger API documentation is enabled in all non-production environments (and controllable via `ENABLE_SWAGGER`). In a staging environment accessible to external parties, this exposes complete API contracts.

---

## 7. Multi-Tenant Isolation Findings

### 7.1 Application-layer isolation: STRONG

All financial services (`PaymentService`, `ReportService`, `BillingService`) receive `organizationId` from `req.user.organization_id` (set by JWT validation) and include it in every database query. The `BillingController.resolveOrganizationId()` method explicitly compares the path parameter against the caller's JWT-derived org ID and throws `ForbiddenException` if they differ, preventing IDOR on billing endpoints.

### 7.2 Database-layer isolation: STRONG

The `EnforceRLSPolicies` migration applies:
- `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` on 30+ financial tables.
- Strict policies: empty/unset `app.current_org_id` matches nothing (denies everything) for non-bypass contexts.
- Child tables resolved via parent table joins — no direct `organization_id` column needed on `form_fields`, `installment_plan_items`, etc.

### 7.3 Bypass mechanisms

The `app.rls_bypass = 'on'` GUC is set for:
1. **Migration data source:** Statically set in `data-source.ts` connection options; correct and safe.
2. **System/public contexts:** Automatically set when no authenticated organization is present (webhooks, public form rendering, authentication bootstrap). This is necessary but means any code path running in system context has unrestricted database access.
3. **`OrganizationContextService.setSystemContext()`:** Called explicitly for unauthenticated requests.

**Risk:** Any code path that accidentally ends up in system context (e.g., if `SetOrganizationContextInterceptor` fails silently, or if a service is invoked outside the interceptor chain) would have RLS bypassed. The patcher mitigates this by re-checking context on every query.

### 7.4 `organizations` table: NOT RLS-protected

The `organizations` table has no RLS policies. All application-level organization queries include explicit `WHERE id = :id` clauses, which is correct, but there is no database-layer backstop preventing a system-context query from reading all organization rows (including `paystack_secret_key` values) if application code contains a mistake.

---

## 8. Developer Access Findings

This section directly addresses the client's concern.

### 8.1 Access through source code

**Confirmed.** A developer with access to the repository can read all payment processing logic, understand the data schema, and learn which Paystack API endpoints are used.

**Impact:** Source code does not by itself expose production data. However, it provides a complete roadmap for any attack.

### 8.2 Access through production environment variables

**Confirmed, with mitigation.** Production secrets (`JWT_SECRET`, `PLATFORM_JWT_SECRET`, `DB_PASSWORD`, Paystack keys) are stored as environment variables in Render (backend) and Vercel (frontend). A developer with access to the Render or Vercel dashboard can read these values.

**Impact:** With `DB_PASSWORD` and `DB_HOST`, the developer can connect directly to the database using a PostgreSQL client and query all financial tables — bypassing RLS entirely, since RLS applies at the database-session level and the application's GUC settings would not be present in a direct connection.

### 8.3 Access through database credentials

**Confirmed.** The application connects to PostgreSQL with credentials stored in environment variables. With those credentials, a developer can query any table directly.

**Mitigation present (partial):** The database user role would still be subject to PostgreSQL-level grants — but only if the application role has restricted column or table grants. Based on the code, no such column-level grants are configured; the application user has full access to all tables.

**Impact: HIGH.** A developer with `DB_PASSWORD` can read all financial data for all schools.

### 8.4 Access through Supabase dashboard

**Potentially confirmed.** The Supabase project owner (which includes the developer) can access the SQL Editor in the Supabase dashboard and query any table without any GUC settings, bypassing RLS. Supabase also provides downloadable database backups.

**This is a fundamental architectural constraint of shared Supabase projects.** There is no application-level control that prevents a Supabase project owner from reading production data.

### 8.5 Access through platform impersonation

**Confirmed.** The platform admin impersonation feature (`POST /platform/organizations/:id/impersonate`) allows any `SUPER`-role platform admin to mint a short-lived token with the rights of any school user. The session is audited, but there is no school-side approval required.

**Impact:** A platform admin can access all financial dashboards, export transactions, and view revenue reports for any school.

### 8.6 Access through per-organization Paystack keys

**Confirmed.** The `organizations` table stores each school's `paystack_secret_key` in plaintext. A developer with database access can retrieve these keys and use them to query the school's Paystack transaction history directly through the Paystack API, completely outside the Payforms application.

**Impact: HIGH.** This not only exposes Payforms transaction records but also the school's full Paystack transaction history (which may include payments not made through Payforms).

### 8.7 Summary table

| Developer Access Path | Status |
|----------------------|--------|
| Read source code | Confirmed — no production data |
| Read production env vars via Render/Vercel dashboard | Confirmed — contains DB credentials |
| Direct DB query with DB credentials | Confirmed — bypasses RLS |
| Supabase SQL Editor (project owner) | Confirmed — bypasses RLS |
| Platform admin dashboard (organization list/stats) | Confirmed — counts only, not financial amounts |
| Platform impersonation | Confirmed — full school access, audited |
| Per-org Paystack keys in DB | Confirmed — full Paystack history accessible |
| Application admin dashboard | Blocked by tenant JWT scoping |

---

## 9. Paystack Integration Findings

### 9.1 Architecture: Per-organization keys

Each school configures its own Paystack account credentials (`paystack_secret_key`, `paystack_public_key`) in their settings. Payforms uses the school's own keys to initialize and verify transactions. Money settles directly into the school's Paystack account.

**Confirmed:** Payforms does not collect payments into a developer-controlled account.

### 9.2 Webhook signature verification

**Pre-fix:** Used JavaScript's `===` operator for HMAC comparison — a non-constant-time operation vulnerable to timing side-channel attacks.

**Post-fix:** Uses `crypto.timingSafeEqual()` with a hex format pre-validation (rejects non-128-hex-character signatures before any org key is touched).

### 9.3 Duplicate event handling

**Confirmed strong.** The `payment_logs` table has a unique index on `(payment_id, event_id)`. The `applyPaystackOutcome()` method checks for an existing log entry with the same `event_id` and returns early if found. Duplicate webhooks do not create duplicate records.

### 9.4 Amount validation

**Pre-fix:** Paystack-reported `amount` was applied directly to `amount_paid` without comparing it to the expected payment amount. A valid webhook from a low-value transaction on the same organization's Paystack account could set `amount_paid` well below the expected amount.

**Post-fix:** When Paystack reports `status = 'success'` but the reported amount is less than `payment.amount`, the status is downgraded from `PAID` to `PARTIAL` and a warning is logged. The payment is not marked fully settled unless the confirmed amount meets the expected amount.

### 9.5 Server-side verification

**Confirmed.** Payment initialization uses `payment.amount` from the database (not a client-supplied value). The Paystack callback triggers a server-side re-verification call to `https://api.paystack.co/transaction/verify/:reference`. The client cannot mark a payment as successful by modifying frontend requests.

### 9.6 Frontend exposure

**Confirmed safe.** Only `NEXT_PUBLIC_*` variables are in the frontend bundle — `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_APP_URL`. No Paystack secret keys, JWT secrets, or database credentials are exposed to the browser.

---

## 10. Identified Vulnerabilities

### FINDING-001 — Non-constant-time HMAC comparison

| Attribute | Value |
|-----------|-------|
| Severity | HIGH |
| File | `apps/backend/src/modules/payment/services/payment.service.ts` |
| Evidence | `if (expected === signature)` — JavaScript `===` is not constant-time |
| Attack Scenario | Adversary with high-frequency webhook access could measure response time differences to learn whether a guessed HMAC prefix matches, enabling incremental brute-force of the Paystack secret key |
| Impact | Potential exposure of per-organization Paystack secret keys |
| Status | **FIXED** — replaced with `crypto.timingSafeEqual()` |

---

### FINDING-002 — Paystack amount not validated against expected payment amount

| Attribute | Value |
|-----------|-------|
| Severity | HIGH |
| File | `apps/backend/src/modules/payment/services/payment.service.ts` |
| Evidence | `applyPaystackOutcome()` passed Paystack-reported amount directly to `updateStatus()` without comparing it to `payment.amount` |
| Attack Scenario | An attacker who obtains a valid Paystack signature for a low-value transaction (e.g., by making a ₦1 payment through the same school's Paystack account) replays the webhook for a ₦50,000 payment record, setting `amount_paid = 1` and status = `PARTIAL` |
| Impact | Under-payment recorded as partially settled; could allow manipulation of outstanding balances in partial-payment workflows |
| Status | **FIXED** — added amount comparison; Paystack-reported amount < expected amount now downgrades `PAID` to `PARTIAL` |

---

### FINDING-003 — Paystack API errors logged with full axios error object

| Attribute | Value |
|-----------|-------|
| Severity | MEDIUM |
| File | `apps/backend/src/modules/payment/services/payment.service.ts` |
| Evidence | `console.error('Paystack initialization error:', error)` — axios errors include the request config which contains the `Authorization: Bearer sk_live_...` header |
| Attack Scenario | A developer with access to production logs (e.g., Render dashboard, log aggregator) can extract the organization's Paystack secret key from any failed payment initialization or verification log entry |
| Impact | Paystack secret key exposure in production logs |
| Status | **FIXED** — now logs only HTTP status code and message; `Authorization` header and other sensitive fields are excluded |

---

### FINDING-004 — Schema synchronization enabled for non-development environments

| Attribute | Value |
|-----------|-------|
| Severity | MEDIUM |
| File | `apps/backend/src/app.module.ts`, `apps/backend/src/data-source.ts` |
| Evidence | `synchronize: process.env.NODE_ENV !== 'production'` — this enables auto-sync in any environment where `NODE_ENV` is not exactly `'production'`, including staging, CI, and misconfigured deployments |
| Attack Scenario | A staging or test environment accidentally connected to a production database (e.g., via misconfigured env vars) could auto-alter schema and silently drop columns containing financial data |
| Impact | Potential data loss in production-adjacent environments |
| Status | **FIXED** — changed to `process.env.NODE_ENV === 'development'` |

---

### FINDING-005 — Paystack secret keys stored in plaintext in database

| Attribute | Value |
|-----------|-------|
| Severity | HIGH |
| File | `apps/backend/src/modules/organization/entities/organization.entity.ts` |
| Evidence | `paystack_secret_key: string` column with no encryption annotation |
| Attack Scenario | A developer with database access retrieves all `paystack_secret_key` values from the `organizations` table. They can then query each school's full Paystack transaction history directly through the Paystack API |
| Impact | Full Paystack transaction history for all schools is accessible to anyone with database read access |
| Recommended Remediation | Encrypt Paystack secret keys using AES-256-GCM before storing them. The encryption key must be stored separately from the database (e.g., as a KMS-managed secret or deployment environment variable). See PAYFORMS_SECURITY_REMEDIATION.md for the migration plan |
| Status | **NOT FIXED** — requires a production data migration with a reviewed recovery plan. Documented for explicit resolution |

---

### FINDING-006 — Developer can access all financial data through database credentials

| Attribute | Value |
|-----------|-------|
| Severity | HIGH (by client threat model) |
| File | Infrastructure (Render environment variables, Supabase project settings) |
| Evidence | `DB_PASSWORD` stored as Render environment variable; any Render team member can view it; Supabase project owner has SQL Editor access |
| Attack Scenario | A developer accesses Render dashboard → views `DB_PASSWORD` → connects to Supabase PostgreSQL via psql or TablePlus → queries `SELECT * FROM payments` for any organization |
| Impact | Full access to all financial records for all schools. RLS does not apply to direct connections unless GUCs are set explicitly |
| Recommended Remediation | (1) Apply least-privilege PostgreSQL role grants — remove `SELECT` on financial tables from the application role; create a separate read-only role for developer access. (2) Use connection proxies (e.g., Supabase's role-based connection strings) that enforce RLS. (3) Apply application-level field encryption for the most sensitive financial amounts. (4) Implement Supabase PITR and audit log export to a separately controlled location |
| Status | **NOT FIXED** — requires infrastructure changes outside the application codebase |

---

### FINDING-007 — Platform impersonation provides developer access to school financial data

| Attribute | Value |
|-----------|-------|
| Severity | MEDIUM (mitigated by audit logging) |
| File | `apps/backend/src/modules/platform-impersonation/platform-impersonation.service.ts` |
| Evidence | `POST /platform/organizations/:id/impersonate` mints a full tenant token for any user in any organization |
| Attack Scenario | Platform admin logs in → starts impersonation session → views financial dashboard → exports transactions CSV for any school |
| Impact | Full read access to financial data; actions appear in audit logs attributed to the platform admin |
| Recommended Remediation | (1) Require school admin approval for impersonation sessions (a notification with an approve/deny link). (2) Allow the school to disable impersonation entirely via organization settings. (3) Alert the school when an impersonation session is started |
| Status | **PARTIALLY MITIGATED** — impersonation is fully audited and can be disabled per-organization via feature flag. School-side approval workflow is a recommended enhancement |

---

### FINDING-008 — CORS allows all Vercel preview deployments

| Attribute | Value |
|-----------|-------|
| Severity | LOW |
| File | `apps/backend/src/main.ts` |
| Evidence | `/^https:\/\/.*\.vercel\.app$/.test(origin)` — allows any Vercel-hosted application |
| Attack Scenario | An adversary deploys a malicious page on Vercel and uses it to make authenticated requests to the Payforms API from a victim's browser that has a valid `pf_access_token` cookie |
| Impact | Limited — requires social engineering to get the victim to visit the malicious Vercel page |
| Recommended Remediation | Restrict Vercel preview CORS to specific deployment slugs or project prefixes matching the Payforms Vercel project name |
| Status | **NOT FIXED** — low priority; requires Vercel project configuration knowledge |

---

### FINDING-009 — `PLATFORM_JWT_SECRET` derives from `JWT_SECRET` without hard production enforcement

| Attribute | Value |
|-----------|-------|
| Severity | LOW |
| File | `apps/backend/src/modules/platform-auth/platform-jwt.config.ts` |
| Evidence | Falls back to `${JWT_SECRET}::platform-admin` with a warning log — does not crash in production |
| Attack Scenario | A developer who has `JWT_SECRET` can derive `PLATFORM_JWT_SECRET` and forge platform admin tokens if the fallback is active in production |
| Impact | Platform admin token forgery |
| Recommended Remediation | Add `if (isProduction && !explicit) throw new Error(...)` to force an explicit `PLATFORM_JWT_SECRET` in production |
| Status | **NOT FIXED** — requires a one-line code change and a Render environment variable update |

---

## 11. Test Results

### Automated tests executed

```
Test Suites: 11 passed, 11 total
Tests:       88 passed, 88 total
Time:        68.11 s
```

Suites included: `payment.service.spec.ts`, `platform-organizations.service.spec.ts`, `rls.helper.spec.ts`, `organization-context.service.spec.ts`, `billing.controller.spec.ts`, `set-organization-context.interceptor.spec.ts`, `organization.controller.spec.ts`, `billing.service.spec.ts` (partial), and others.

**All tests passed after security remediations were applied.**

### TypeScript type check

`npx tsc --noEmit` — Exit code 0. No type errors introduced by security changes.

### Tests not performed (require live environment)

- Database-level RLS test: connecting as the application role without GUC settings to verify policies deny access
- Direct PostgreSQL connection test to confirm RLS bypass path
- Webhook signature brute-force timing test (requires network instrumentation)
- Paystack amount mismatch test (requires test Paystack account with webhook delivery)
- Platform impersonation session token validation against revocation

---

## 12. Unresolved Issues and Residual Risks

1. **Paystack secret keys in plaintext** (FINDING-005): Application-level encryption is recommended but requires a production data migration.
2. **Developer database access** (FINDING-006): The developer retains the ability to query all financial data via direct database access. This can only be addressed through PostgreSQL role restrictions, encryption, or a separate per-school database architecture.
3. **Supabase project owner access**: The Supabase project owner (which includes the developer) can use the SQL Editor to query all data without RLS. This cannot be prevented within the current single-project shared architecture.
4. **TLS `rejectUnauthorized: false`**: The database connection does not validate the TLS certificate chain. This is a known Supabase pooler limitation but creates a MITM risk on the database connection.
5. **`PLATFORM_JWT_SECRET` enforcement**: Not a hard production crash yet.
6. **Broad Vercel CORS**: Low risk but not remediated.

---

## 13. Scope Limitations

- The live Supabase configuration (IAM settings, role grants, backup configuration) was not inspected — only the application source code.
- The Render deployment environment variables are not accessible from the repository.
- RLS policies were verified from migration source code; their presence in the live database was not confirmed.
- Paystack webhook delivery and timing side-channel tests were not performed against a live environment.
- Supabase Storage bucket policies were not inspected.
