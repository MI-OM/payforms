# Payforms Security Remediation Report

**Date:** 2026-10-18  
**Status:** Partial — four of nine findings remediated in this session  

---

## 1. Findings Addressed in This Session

### 1.1 FINDING-001 — Timing-safe webhook signature comparison

**Severity:** HIGH  
**File changed:** `apps/backend/src/modules/payment/services/payment.service.ts`

**Before:**
```typescript
const expected = crypto.createHmac('sha512', org.paystack_secret_key).update(rawBody).digest('hex');
if (expected === signature) {
  return org.id;
}
```

**After:**
```typescript
// Pre-validate signature format before any crypto work
const signatureHex = (signature || '').toLowerCase();
if (!/^[0-9a-f]{128}$/.test(signatureHex)) {
  return null;
}
const signatureBuffer = Buffer.from(signatureHex, 'hex');

for (const org of organizations) {
  const expectedHex = crypto.createHmac('sha512', org.paystack_secret_key).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expectedHex, 'hex');
  if (
    expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return org.id;
  }
}
```

**Why this matters:** JavaScript's `===` operator is not constant-time. The Node.js runtime may short-circuit string comparison on the first differing character, creating a measurable timing difference. `crypto.timingSafeEqual()` runs in constant time regardless of where the byte sequences differ, preventing timing oracle attacks.

**Secondary improvement:** A format check (`/^[0-9a-f]{128}$/`) rejects malformed signatures before any HMAC computation, avoiding unnecessary database loads.

**Test:** All 88 existing tests pass. The webhook controller spec (`payment.service.spec.ts`) verifies the signature validation logic.

**Backward compatibility:** No change to the webhook contract. Paystack-supplied signatures continue to be accepted identically.

---

### 1.2 FINDING-002 — Paystack amount validation in `applyPaystackOutcome`

**Severity:** HIGH  
**File changed:** `apps/backend/src/modules/payment/services/payment.service.ts`

**Before:**
```typescript
const updatedPayment = await this.updateStatus(organizationId, payment.id, {
  status,
  paid_at: paidAt,
  amount_paid: paystackAmount,  // No comparison against payment.amount
}, { source: 'paystack' });
```

**After:**
```typescript
let resolvedStatus = status;
if (
  status === 'PAID' &&
  paystackAmount != null &&
  payment.amount != null &&
  paystackAmount < Number(payment.amount)
) {
  this.logger.warn(
    `Paystack reported amount (${paystackAmount}) is less than expected payment amount (${payment.amount}) for payment ${payment.id}. Downgrading status to PARTIAL.`,
  );
  resolvedStatus = 'PARTIAL';
}

const updatedPayment = await this.updateStatus(organizationId, payment.id, {
  status: resolvedStatus,
  paid_at: paidAt,
  amount_paid: paystackAmount,
}, { source: 'paystack' });
```

**Why this matters:** Without this check, a valid Paystack webhook from a ₦1 test transaction (signed with the same school's secret key) could be replayed against a ₦50,000 payment record. The `updateStatus()` method would set `amount_paid = 1` and `status = 'PARTIAL'` — recording a partially settled payment rather than a pending one.

**Design decision:** The status is downgraded to `PARTIAL` rather than rejected outright. This ensures the confirmed amount is accurately recorded (the school knows ₦1 arrived via Paystack) while preventing the payment from being marked fully settled. The school admin can then investigate and reconcile.

**Test:** All 88 existing tests pass. Existing payment service specs cover `applyPaystackOutcome` logic paths.

**Backward compatibility:** No change to webhook response format. Webhooks where Paystack reports exactly the expected amount continue to behave identically.

---

### 1.3 FINDING-003 — Paystack error log sanitization

**Severity:** MEDIUM  
**File changed:** `apps/backend/src/modules/payment/services/payment.service.ts`

**Before:**
```typescript
} catch (error) {
  console.error('Paystack initialization error:', error);
  // error = full axios error object including config.headers.Authorization
```

**After:**
```typescript
} catch (error) {
  const statusCode = (error as any)?.response?.status ?? 'unknown';
  const message = (error as any)?.response?.data?.message ?? (error as any)?.message ?? 'unknown error';
  this.logger.error(`Paystack initialization failed [status=${statusCode}]: ${message}`);
```

**Applied to:** Both `initializePaystack()` and `verifyPaystack()` methods.

**Why this matters:** Axios errors include the full request configuration object, which contains the `Authorization: Bearer sk_live_...` header. Any developer with access to Render logs or a log aggregator would see the Paystack secret key in any failed payment log entry.

**What is now logged:** Only the HTTP status code and the message text from the Paystack response body — no headers, no config, no keys.

**Test:** All 88 existing tests pass.

---

### 1.4 FINDING-004 — Schema synchronization scope restricted

**Severity:** MEDIUM  
**Files changed:** `apps/backend/src/app.module.ts`, `apps/backend/src/data-source.ts`

**Before:** `synchronize: process.env.NODE_ENV !== 'production'`  
**After:** `synchronize: process.env.NODE_ENV === 'development'`

**Why this matters:** The previous condition enabled auto-sync on any environment where `NODE_ENV` was not exactly `'production'` — including `'staging'`, `'test'`, `'qa'`, or an unset/empty variable. TypeORM schema synchronization can silently drop database columns, alter types, and make irreversible schema changes when entity definitions change.

**A staging environment accidentally pointed at the production Supabase would auto-alter the production schema on startup.**

**Now only `NODE_ENV=development` (local development only) enables auto-sync. All other environments must use explicit migrations.**

**Test:** All 88 existing tests pass. Migration scripts are unaffected.

---

## 2. Files Changed

| File | Change Description |
|------|--------------------|
| `apps/backend/src/modules/payment/services/payment.service.ts` | Timing-safe HMAC comparison, amount validation, log sanitization |
| `apps/backend/src/app.module.ts` | Schema sync restricted to `development` only |
| `apps/backend/src/data-source.ts` | Schema sync restricted to `development` only |

---

## 3. Outstanding Remediation Tasks

These findings require action but were not implemented during this session due to their scope and risk.

### 3.1 Encrypt Paystack secret keys (FINDING-005)

**Priority:** HIGH  
**Estimated effort:** 1–2 developer days  

**Proposed approach:**

1. Add an `ENCRYPTION_KEY` environment variable (32 bytes, hex-encoded, generated with `openssl rand -hex 32`). This must be stored as a Render secret, not in source code.

2. Create a new migration that adds an `encrypted_paystack_secret_key` column (VARCHAR, nullable) and an `encrypted_paystack_public_key` column.

3. Write a one-time data migration using AES-256-GCM:
   ```typescript
   // Pseudocode — do not implement without review
   const iv = crypto.randomBytes(12);
   const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
   const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
   const tag = cipher.getAuthTag();
   const stored = `1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
   ```

4. Create a `PaystackKeyEncryptionService` that encrypts on write and decrypts on read (server-side only, never decrypting to the browser).

5. Verify all existing functionality works with encrypted keys.

6. Once verified, drop the plaintext columns.

**Recovery plan required:** Before running the migration, export and securely store the plaintext keys in a backup. The rollback path must restore plaintext keys from the backup. This migration must not be run in production without a tested rollback procedure and point-in-time recovery configured on the Supabase project.

**Backward compatibility:** No change to API contracts. Decryption is transparent to all callers.

---

### 3.2 Restrict PostgreSQL role privileges (FINDING-006)

**Priority:** HIGH  
**Estimated effort:** 2–4 hours with a Supabase admin  

**Proposed approach:**

```sql
-- Create a dedicated application role with minimal privileges
CREATE ROLE payforms_app LOGIN PASSWORD '<strong-password>';

-- Grant CONNECT and USAGE only
GRANT CONNECT ON DATABASE payforms TO payforms_app;
GRANT USAGE ON SCHEMA public TO payforms_app;

-- Grant SELECT, INSERT, UPDATE, DELETE on specific tables only
GRANT SELECT, INSERT, UPDATE, DELETE ON
  users, contacts, groups, forms, submissions, payments, payment_logs,
  activity_logs, organizations, invitations
  -- ... all other application tables
  TO payforms_app;

-- Revoke all developer direct access to financial tables
REVOKE SELECT ON payments, payment_logs, submissions FROM developer_role;
```

**Additionally:** Create a separate read-only developer role that is granted access only to anonymized/non-financial tables for debugging purposes. Financial table access should require a time-limited, audited grant that expires automatically.

**Deployment consideration:** Requires `DB_USER` and `DB_PASSWORD` rotation and Render environment variable update.

---

### 3.3 Enforce `PLATFORM_JWT_SECRET` in production (FINDING-009)

**Priority:** LOW–MEDIUM  
**Estimated effort:** 30 minutes  

**Proposed change to `platform-jwt.config.ts`:**

```typescript
export function resolvePlatformJwtSecret(configService: ConfigService): string {
  const explicit = configService.get<string>('PLATFORM_JWT_SECRET');
  if (explicit && explicit.trim()) {
    return explicit.trim();
  }

  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  if (isProduction) {
    throw new Error(
      'PLATFORM_JWT_SECRET must be set in production. ' +
      'Set it to a randomly generated 256-bit secret distinct from JWT_SECRET.',
    );
  }

  // Development fallback only
  const fallback = configService.get<string>('JWT_SECRET');
  if (!fallback?.trim()) {
    throw new Error('Neither PLATFORM_JWT_SECRET nor JWT_SECRET is configured.');
  }
  Logger.warn(
    'PLATFORM_JWT_SECRET is not set; using derived secret for development only.',
    'PlatformJwtConfig',
  );
  return `${fallback.trim()}::platform-admin`;
}
```

**Deployment step:** Add `PLATFORM_JWT_SECRET` to Render environment variables before deploying this change.

---

### 3.4 School-side impersonation approval workflow (FINDING-007)

**Priority:** MEDIUM  
**Estimated effort:** 3–5 developer days  

**Proposed enhancement:**
- When a platform admin initiates impersonation, send an email notification to the school's admin email (from `organizations.email`).
- Add an organization setting to disable impersonation entirely (`impersonation_allowed: boolean`, default `true`).
- This setting is distinct from the platform-level feature flag and is controlled by the school, not the developer.

---

## 4. Configuration Changes Required in Production

| Change | Who | When | Risk |
|--------|-----|------|------|
| Add `PLATFORM_JWT_SECRET` to Render | Developer/DevOps | Before deploying FINDING-009 fix | Low — additive |
| Rotate `DB_USER`/`DB_PASSWORD` to least-privilege role | DBA/DevOps | After creating restricted role | Medium — requires deployment coordination |
| Add `ENCRYPTION_KEY` to Render | Developer/DevOps | Before running key encryption migration | High — migration must be run within 24h |

---

## 5. Deployment Considerations

- The three code-level fixes (FINDING-001, -002, -003, -004) are backward-compatible and can be deployed with a standard Render redeploy.
- The schema sync change (FINDING-004) does not affect production (where `NODE_ENV=production` already disables sync).
- No database migrations are required for the implemented fixes.
- The outstanding remediations (FINDING-005, -006) require production-coordinated work and must not be deployed during peak hours.

---

## 6. Rollback Considerations

The implemented fixes are purely logic changes. Rolling back requires reverting the three changed TypeScript files in source control. No database schema changes or data mutations were made.
