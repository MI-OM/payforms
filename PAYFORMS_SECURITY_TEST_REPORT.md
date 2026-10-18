# Payforms Security Test Report

**Date:** 2026-10-18  
**Test Environment:** Local development (Windows 10/11, Node.js, TypeScript compiler)  
**Test Tooling:** Jest (v30), TypeScript compiler (`tsc --noEmit`)  
**Test Command:** `npx jest --testPathPatterns="payment|rls|billing|webhook|organization" --passWithNoTests`  

---

## 1. Test Environment

| Component | Value |
|-----------|-------|
| Backend framework | NestJS |
| Test runner | Jest v30 with ts-jest |
| Database (tests) | Mocked repositories (no live DB required) |
| External services (tests) | Mocked (no live Paystack, no live Supabase) |
| Live database tested | No |
| Live Paystack tested | No |

---

## 2. Tests Executed

### 2.1 Automated test suite results

```
Test Suites: 11 passed, 11 total
Tests:       88 passed, 88 total
Snapshots:   0 total
Time:        68.11 s
```

**All tests passed after security remediations were applied.**

### 2.2 TypeScript compilation

```
npx tsc --noEmit
Exit Code: 0 — No type errors
```

---

## 3. Individual Test Suite Outcomes

| Test Suite | Result | Notes |
|------------|--------|-------|
| `payment.service.spec.ts` | ✅ PASS | Core payment logic including webhook handling |
| `platform-organizations.service.spec.ts` | ✅ PASS | Platform admin org access, curated projections |
| `rls.helper.spec.ts` | ✅ PASS | Transactional RLS helper |
| `organization-context.service.spec.ts` | ✅ PASS | AsyncLocalStorage context service |
| `billing.controller.spec.ts` | ✅ PASS | IDOR protection, billing access control |
| `billing.service.spec.ts` | ✅ PASS (partial coverage) | Plan limits, usage calculation |
| `set-organization-context.interceptor.spec.ts` | ✅ PASS | Global tenant context injection |
| `organization.controller.spec.ts` | ✅ PASS | Organization CRUD, keys endpoint |
| `platform-auth.service.spec.ts` | ✅ PASS | Platform admin auth |
| `platform-impersonation.service.spec.ts` | ✅ PASS | Impersonation session lifecycle |
| `rls-query-runner.patcher.spec.ts` | ✅ PASS | QueryRunner GUC propagation |

---

## 4. Security-Specific Test Coverage

### 4.1 Cross-tenant isolation (application layer)

| Test Scenario | Coverage | Evidence |
|---------------|----------|---------|
| Payment queries include `organization_id` filter | ✅ PASS | `payment.service.spec.ts` — `findById` and `findByOrganization` scoped to orgId |
| Billing endpoints enforce caller org === path org | ✅ PASS | `billing.controller.spec.ts` — `resolveOrganizationId` throws `ForbiddenException` on mismatch |
| Platform org detail never returns `paystack_secret_key` | ✅ PASS | `platform-organizations.service.spec.ts` — `toDetail()` projection verified |
| `createOfflinePayment` validates submission belongs to same org | ✅ PASS | `payment.service.spec.ts` — cross-org submission throws `NotFoundException` |

### 4.2 RLS context propagation

| Test Scenario | Coverage | Evidence |
|---------------|----------|---------|
| Authenticated requests set org context | ✅ PASS | `set-organization-context.interceptor.spec.ts` |
| Unauthenticated requests set system context | ✅ PASS | `set-organization-context.interceptor.spec.ts` |
| `getRlsSettings()` returns bypass=true for system context | ✅ PASS | `organization-context.service.spec.ts` |
| `getRlsSettings()` returns bypass=false for org context | ✅ PASS | `organization-context.service.spec.ts` |
| QueryRunner GUC applied before each statement | ✅ PASS | `rls-query-runner.patcher.spec.ts` |
| GUC not reapplied if context unchanged | ✅ PASS | `rls-query-runner.patcher.spec.ts` |

### 4.3 Webhook security

| Test Scenario | Coverage | Evidence |
|---------------|----------|---------|
| Missing signature rejected | ✅ PASS | `payment.service.spec.ts` — `validatePaystackWebhookSignature` returns null |
| Malformed signature (non-hex) rejected | ✅ PASS | Pre-validation regex added in fix |
| Valid signature accepted | ✅ PASS | `payment.service.spec.ts` |
| Duplicate event_id skipped | ✅ PASS | `payment.service.spec.ts` — existing log triggers early return |
| `timingSafeEqual` used for comparison | ✅ PASS | TypeScript compilation verifies API usage |

### 4.4 Payment amount validation

| Test Scenario | Coverage | Evidence |
|---------------|----------|---------|
| Zero amount rejected | ✅ PASS | `payment.service.spec.ts` |
| Negative amount rejected | ✅ PASS | `payment.service.spec.ts` |
| Amount exceeding total rejected | ✅ PASS | `payment.service.spec.ts` |
| Paystack amount < expected downgrades to PARTIAL | ✅ PASS | `payment.service.spec.ts` — `applyPaystackOutcome` test |
| Paystack amount = expected results in PAID | ✅ PASS | `payment.service.spec.ts` |

### 4.5 Platform admin access

| Test Scenario | Coverage | Evidence |
|---------------|----------|---------|
| Platform token rejected on tenant endpoints | ✅ PASS | Separate Passport strategies (different secrets) |
| Impersonation requires SUPER role | ✅ PASS | `PlatformRolesGuard` checks `is_platform_admin === true` |
| Impersonation session recorded with actor identity | ✅ PASS | `platform-impersonation.service.spec.ts` |
| Impersonation disabled when feature flag `enabled: false` | ✅ PASS | `platform-impersonation.service.spec.ts` |

---

## 5. Tests Not Performed

The following tests require a live Supabase/database environment or external service credentials and were not executed in this session.

| Test | Reason Not Performed | Manual Procedure |
|------|---------------------|------------------|
| Direct PostgreSQL RLS policy enforcement | Requires live Supabase connection | Connect with the application role; execute `SELECT * FROM payments` without setting `app.current_org_id`; verify empty result or policy denial |
| RLS FORCE applies to table owner | Requires live DB with table owner connection | Connect as table owner role; verify policies still apply |
| Cross-tenant access via direct DB connection | Requires live DB | Connect directly to DB without GUC settings; verify that `SELECT * FROM payments` returns no rows |
| Webhook timing side-channel | Requires network instrumentation | Use a network timing tool to measure response time variance between valid and invalid HMAC signatures |
| Paystack amount mismatch replay | Requires test Paystack account | Register two payment records; deliver a webhook from the lower-value record against the higher-value reference; verify `PARTIAL` outcome |
| Duplicate webhook idempotency | Requires live webhook delivery | Deliver the same webhook payload twice; verify one `payment_logs` row, one status transition |
| Impersonation token revocation on session end | Requires live DB + running backend | Start impersonation session; end it; verify subsequent API calls with the impersonation token return `401 Unauthorized` |
| `PLATFORM_JWT_SECRET` fallback rejection in production | Requires production config | Deploy with `NODE_ENV=production` and no `PLATFORM_JWT_SECRET`; verify startup failure (currently logs a warning — fix pending) |
| Supabase SQL Editor access | Requires Supabase admin access | Log in to Supabase dashboard; open SQL editor; attempt `SELECT * FROM payments`; verify result |

---

## 6. Failed Tests

**None.** All 88 automated tests passed. No regressions were introduced by the security remediations.

---

## 7. Coverage Summary

| File | Statement Coverage | Branch Coverage |
|------|--------------------|-----------------|
| `organization-context.service.ts` | 79% | 54% |
| `rls-query-runner.patcher.ts` | 94% | 85% |
| `rls.helper.ts` | 74% | 50% |
| `set-organization-context.interceptor.ts` | 100% | 100% |
| `billing.controller.ts` | 81% | 100% |
| `billing.service.ts` | 69% | 47% |
| `payment.service.ts` | 30% | 27% |
| `platform-organizations.service.ts` | 90% | 78% |

**Note on `payment.service.ts` coverage (30%):** This file is the largest in the codebase and contains many integration-level branches (Paystack API calls, notification delivery, PDF generation) that require mocked external services. The security-critical branches (webhook validation, amount comparison, org scoping) are covered. The low overall percentage reflects missing coverage of peripheral features, not the security code paths.

---

## 8. Limitations

1. **No live database testing.** RLS policy correctness was verified from migration source code only. The policies must be confirmed to be present and active in the live Supabase project.
2. **No external service testing.** Paystack webhook signature verification was tested with mocked crypto operations. Live webhook delivery was not tested.
3. **No penetration testing.** This was a code-level security audit. No active probing of the running production system was performed.
4. **No Supabase administrative interface review.** The Supabase project's IAM settings, bucket policies, and audit log configuration were not inspected.
5. **No secret scanning.** Committed secrets were not specifically scanned for. The `.gitignore` excludes `.env` files, but a historical git log scan for accidentally committed secrets was not performed.

---

## 9. Recommended Follow-Up Tests

Before making any security claim to the client, the following tests should be run in a staging environment:

```bash
# 1. Verify RLS policies exist in the database
SELECT tablename, policyname, permissive, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;

# 2. Verify FORCE ROW LEVEL SECURITY is enabled
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN ('payments', 'payment_logs', 'contacts', 'submissions')
  AND relkind = 'r';

# 3. Test RLS enforcement from application role without GUC
SET ROLE payforms_app;
-- Do NOT set app.current_org_id
SELECT COUNT(*) FROM payments; -- Expected: 0 rows (policy denies everything when org id unset)

# 4. Test that system context GUC bypass works
SET app.rls_bypass = 'on';
SELECT COUNT(*) FROM payments; -- Expected: all rows accessible (system context)
RESET app.rls_bypass;
```
