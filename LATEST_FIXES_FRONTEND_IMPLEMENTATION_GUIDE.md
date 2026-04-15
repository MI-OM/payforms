# Latest Fixes and Frontend Implementation Guide

This document summarizes the latest backend fixes and the recommended frontend implementation approach.

It starts with the offline form payment fix, then covers related updates that affect checkout, contact experience, receipts, notifications, and audit views.

## 1) Offline Form Payment Fix (Primary)

### Problem solved
- Admin/staff previously needed to manually provide `submission_id` to record offline payments.
- This created fragile frontend logic and inconsistent status handling.

### Backend implementation summary
- Added dedicated endpoint for offline capture:
  - `POST /payments/offline`
- Backend now:
  - validates form ownership and contact ownership
  - validates organization-enabled payment methods
  - creates a linked submission automatically
  - records payment and derives final status from balance

### Endpoint
- `POST /payments/offline`
- Auth: admin/staff auth required
- Body:
  - `form_id: string`
  - `contact_id: string`
  - `amount: number`
  - `payment_method: CASH | BANK_TRANSFER | POS | CHEQUE`
  - `external_reference?: string`
  - `confirmation_note?: string`
  - `paid_at?: ISO date`

### Status rule (important)
- Backend derives payment status from outstanding balance.
- If balance remains: status is persisted as `PARTIAL`.
- If balance is zero: status is persisted as `PAID`.
- Frontend should not assume that sending `status=PAID` guarantees persisted `PAID` when balance exists.

### Frontend workflow
1. Admin selects contact and form.
2. Frontend submits offline payment data to `POST /payments/offline`.
3. Backend response is source of truth for:
   - `status`
   - `amount_paid`
   - `balance_due`
4. Frontend displays success with explicit outstanding amount when `balance_due > 0`.
5. Optional: route user to receipt download.

### Recommended UI behavior
- Show status badge from backend (`PAID` or `PARTIAL`).
- Always show these values after save:
  - `total_amount`
  - `amount_paid`
  - `balance_due`
- If `PARTIAL`, show a clear next action (record follow-up payment, monitor pending balance).

## 2) Manual and Offline Review Status Normalization

### Problem solved
- Inconsistent state was possible (`PAID` with remaining balance).

### Backend implementation summary
- `POST/PATCH /payments/:id/status` and offline review flows now derive final stored status from balance.
- `amount_paid` is treated as paid-to-date for status derivation.

### Endpoints affected
- `POST /payments/:id/status`
- `PATCH /payments/:id/status`
- `POST /payments/:id/offline-review`
- `PATCH /payments/:id/offline-review`

### Frontend workflow
1. Send update request.
2. Always refresh row/detail from response.
3. Render returned status and balance fields.
4. Do not locally override returned status.

## 3) Receipt Upgrade: Total, Paid, Balance

### Problem solved
- Receipt/invoice views lacked explicit outstanding balance visibility.

### Backend implementation summary
- Receipt generation now includes:
  - `total amount`
  - `amount paid`
  - `balance due`
  - payment method and confirmation metadata (when available)

### Endpoints affected
- `GET /payments/:id/receipt`
- `GET /payments/reference/:reference/receipt`
- `GET /contact-auth/payments/:id/receipt`
- `GET /contact-auth/payments/reference/:reference/receipt`

### Frontend workflow
- Keep download actions the same.
- Update UI labels/help text to explain that receipts now include outstanding balance details.
- For partial payments, provide a prominent "balance remaining" indicator next to receipt download.

## 4) Strict Contact Form Visibility

### Problem solved
- Contacts could see forms that were not explicitly assigned in some targeted setups.

### Backend implementation summary
- For contact-accessible forms:
  - `TARGETED_ONLY` forms with no targets are not returned.
  - Access remains for explicitly targeted contacts/groups.

### Endpoint affected
- `GET /contact-auth/forms`

### Frontend workflow
- Treat `/contact-auth/forms` response as authoritative eligibility.
- Remove frontend fallback assumptions that empty-target forms are always visible.
- Show empty-state messaging when no forms are assigned.

## 5) Contact Notifications Insert Fix

### Problem solved
- Some environments could fail inserts with null `id` for contact notifications.

### Backend implementation summary
- Added migration:
  - `1776300000000-FixContactNotificationsPkDefault.ts`
- Ensures DB default UUID generation for `contact_notifications.id`.

### Endpoint behavior impact
- Contact in-app notification creation/read flows become stable where the schema issue existed.

### Frontend workflow
- No API shape change required.
- If notifications previously failed silently, re-test notification list/read flows after migration rollout.

## 6) Audit Actor Label Improvement

### Problem solved
- Some request-originated legacy rows showed `System` despite being user-triggered events with missing actor identity metadata.

### Backend implementation summary
- Audit actor formatter now uses `Unknown Actor` for request-originated rows where actor identity cannot be resolved.

### Endpoint affected
- `GET /audit/logs`

### Frontend workflow
- Render actor label as returned.
- Optional UI hint:
  - `Unknown Actor` means request context existed but identity metadata was unavailable.

## 7) Contact Logo/Branding Bootstrap Fix

### Problem solved
- Contact UI could miss organization logo immediately after login when relying on login response payload only.

### Backend implementation summary
- `POST /contact-auth/login` now includes organization branding payload:
  - `id`
  - `name`
  - `logo_url`
  - `subdomain`
  - `custom_domain`
- `GET /contact-auth/me` still includes branding as before.

### Endpoints affected
- `POST /contact-auth/login`
- `GET /contact-auth/me`

### Frontend workflow
1. On successful contact login, read branding from login response.
2. Store branding in session state immediately.
3. Optionally hydrate/refresh using `GET /contact-auth/me` after app bootstrap.
4. Use returned `logo_url` for header/sidebar branding.

### Recommended fallback order for branding
1. `loginResponse.organization.logo_url`
2. `loginResponse.contact.organization.logo_url`
3. `meResponse.organization.logo_url`
4. default placeholder image/monogram

## 8) Organization-Controlled Checkout Methods

### Problem solved
- Frontend could show payment methods not enabled by organization policy.

### Backend implementation summary
- Organization setting controls allowed methods:
  - `enabled_payment_methods`
- Public form payload now includes allowed methods.
- Backend rejects disabled methods on submit.

### Endpoints affected
- `PATCH /organization`
- `PATCH /organization/settings`
- `GET /organization/settings`
- `GET /public/forms/:slug`
- `GET /public/forms/:slug/widget-config`
- `POST /public/forms/:slug/submit`

### Frontend workflow
1. Fetch form data.
2. Render payment options only from `enabled_payment_methods`.
3. Send chosen method in submit payload.
4. Handle outcomes:
  - free form success
  - online authorization flow
  - offline pending flow

## 9) End-to-End Frontend Implementation Pattern

Use this consistent pattern for payment and contact experiences:

1. Fetch server-configured capabilities first.
  - form methods
  - auth context
  - organization branding
2. Submit minimal required payload.
  - avoid client-generated derived fields when backend already derives them
3. Trust response as source of truth.
  - status
  - balance
  - allowed methods
  - actor labels
4. Reconcile UI state directly from response.
5. Show explicit states for partial/outstanding scenarios.

## 10) Rollout and Verification Checklist

### Backend deployment
- Run all pending migrations, especially:
  - `1776200000000-AddEnabledPaymentMethodsToOrganizations.ts`
  - `1776300000000-FixContactNotificationsPkDefault.ts`

### Frontend verification checklist
- Offline payment creation works without manual `submission_id`.
- Partial payment remains `PARTIAL` when balance exists.
- Receipt displays total, paid, and balance values.
- Contact form list excludes unassigned `TARGETED_ONLY` forms.
- Contact notifications load and read actions succeed.
- Audit list shows `Unknown Actor` for unresolved request-originated rows.
- Contact login immediately shows org logo without waiting for `/contact-auth/me`.
- Public checkout shows only organization-enabled methods.

## 11) Quick API Map

### Payment and checkout
- `POST /payments/offline`
- `POST /payments/:id/status`
- `PATCH /payments/:id/status`
- `POST /payments/:id/offline-review`
- `PATCH /payments/:id/offline-review`
- `GET /payments/:id/receipt`
- `GET /payments/reference/:reference/receipt`
- `POST /public/forms/:slug/submit`

### Contact experience
- `POST /contact-auth/login`
- `GET /contact-auth/me`
- `GET /contact-auth/forms`
- `GET /contact-auth/notifications`
- `PATCH /contact-auth/notifications/:id/read`

### Organization settings
- `GET /organization/settings`
- `PATCH /organization`
- `PATCH /organization/settings`

### Audit
- `GET /audit/logs`
