# Checkout Payment Methods FE Guide

This document describes the new backend support for organization-level checkout payment method control.

## What Changed

Organizations can now decide which payment methods are allowed on checkout.

Supported values:

- `ONLINE`
- `CASH`
- `BANK_TRANSFER`
- `POS`
- `CHEQUE`

Default for existing and new organizations:

- `['ONLINE']`

## Admin Settings Endpoints

Use these endpoints for the organization settings screen.

### `GET /organization/settings`

Response now includes:

```json
{
  "id": "...",
  "name": "...",
  "email": "...",
  "enabled_payment_methods": ["ONLINE", "CASH"]
}
```

### `PATCH /organization` or `PATCH /organization/settings`

Send:

```json
{
  "enabled_payment_methods": ["ONLINE", "CASH"]
}
```

Notes:

- The array is normalized to uppercase.
- Duplicate values are removed.
- If FE sends an empty or invalid list, backend falls back to `['ONLINE']`.

## Public Checkout Endpoints

### `GET /public/forms/:slug`

Response now includes:

```json
{
  "id": "...",
  "title": "School Fees",
  "payment_type": "FIXED",
  "amount": 50000,
  "enabled_payment_methods": ["ONLINE", "BANK_TRANSFER"]
}
```

### `GET /public/forms/:slug/widget-config`

Response now includes:

```json
{
  "form": {
    "id": "...",
    "enabled_payment_methods": ["ONLINE", "BANK_TRANSFER"]
  }
}
```

## FE Rules

On checkout, FE should:

1. Fetch the public form or widget config.
2. Read `enabled_payment_methods`.
3. Render only those methods in the payment-method selector.
4. Default the selection to the first allowed value.
5. Hide offline options completely when only `ONLINE` is enabled.

Recommended labels:

- `ONLINE` → `Pay Online`
- `CASH` → `Cash`
- `BANK_TRANSFER` → `Bank Transfer`
- `POS` → `POS`
- `CHEQUE` → `Cheque`

## Backend Enforcement

Backend now enforces this setting in payment creation and public submission flow.

If FE sends a disabled method, backend returns a `400` with a message like:

```json
{
  "statusCode": 400,
  "message": "CASH payments are disabled for this organization",
  "error": "Bad Request"
}
```

## Admin Offline Capture Flow

For the admin/staff offline payment screen, use the new endpoint:

### `POST /payments/offline`

Request body:

```json
{
  "form_id": "...",
  "contact_id": "...",
  "amount": 25000,
  "payment_method": "CASH",
  "external_reference": "TELLER-447120",
  "confirmation_note": "Paid at school bursary desk"
}
```

What backend does automatically:

- creates a linked submission record
- creates the payment record
- marks payment as `PAID` or `PARTIAL` (for fixed forms where amount is below total and partial is allowed)

So FE should not ask admins for `submission_id` anymore.

## UX Recommendation

For the admin settings page, use a multi-select or checkbox group for payment methods.

Suggested behavior:

- Keep `ONLINE` selected by default.
- Show a note that offline methods create pending payments and require admin confirmation.
- If all offline methods are disabled, the public checkout should behave exactly like the current Paystack-only flow.

## Compatibility Note

This feature depends on the migration:

- `1776200000000-AddEnabledPaymentMethodsToOrganizations.ts`

Deploy backend code and run migrations before relying on `enabled_payment_methods` in FE.