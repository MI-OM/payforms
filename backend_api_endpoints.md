# Payforms Backend API Reference

This is the FE-facing API contract for the current backend codebase.

Every endpoint below includes:
- endpoint
- parameters
- how to use it from FE
- whether it is new or updated where relevant

## Change Log

### New Endpoints

- `GET /submissions/export`
- `DELETE /groups/:id/contacts`
- `PATCH /groups/:id/detach`
- `GET /forms/:id/groups`
- `GET /auth/organization-email/status`
- `GET /auth/2fa/status`
- `POST /auth/2fa/setup`
- `POST /auth/2fa/enable`
- `POST /auth/2fa/disable`
- `POST /auth/2fa/verify-login`
- `POST /auth/2fa/recovery-codes/regenerate`
- `POST /contact-auth/logout`
- `GET /contact-auth/transactions`
- `GET /contact-auth/payments/:id/receipt`
- `GET /contact-auth/payments/reference/:reference/receipt`
- `POST /contacts/imports/csv/validate`
- `POST /contacts/imports/csv/commit`
- `GET /public/payments/verify`
- `GET /payments/:id/receipt`
- `GET /payments/reference/:reference/receipt`
- `GET /payments/offline/pending`
- `POST /payments/:id/offline-review`
- `PATCH /payments/:id/offline-review`
- `GET /notifications/scheduled`
- `POST /notifications/internal`
- `GET /notifications/internal`
- `PATCH /notifications/internal/:id/read`
- `GET /reports/forms/performance`
- `GET /reports/groups/contributions`

### Updated Endpoints

- `POST /public/forms/:slug/submit`
  Updated with `partial_amount`, `payment_method`, and offline-payment initiation support.
- `POST /payments`
  Updated with `payment_method` support.
- `PATCH /payments/:id/status`
  Updated with `payment_method` support and offline confirmation metadata.
- `GET /transactions`
  Updated with `payment_method` filters and CSV export field updates.
- `GET /audit/logs`
  Updated with contact actor support and `contact_id` filtering.
- `PATCH /organization/keys`
  Updated with `paystack_webhook_url` support.
- `PATCH /organization`
  Updated with `partial_payment_limit` support.
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
  Updated to support cookie-backed auth sessions in addition to token responses.
- `POST /auth/login`
  Updated to return a two-factor challenge when staff 2FA is enabled.
- `POST /contact-auth/login`
  Updated to support contact auth cookie session.

### Migration Notes

- `1744396800000-AddPaymentMethodToPayments.ts`: required for payment method selection, offline payment initiation, and transaction filtering.
- `1775779200000-AddOfflinePaymentConfirmationFields.ts`: required for offline review metadata and enriched receipts.
- `1775865600000-AddContactActorToActivityLogs.ts`: required for first-class contact actor audit logs.

## Conventions

- Admin protected routes use `Authorization: Bearer <admin token>`.
- Contact protected routes use `Authorization: Bearer <contact token>` or cookie-backed contact auth.
- Admin auth cookies: `pf_access_token`, `pf_refresh_token`.
- Contact auth cookie: `pf_contact_token`.
- CSV endpoints return file content directly.
- PDF endpoints return binary file content directly.
- Pagination defaults are typically `page=1`, `limit=20`.

## 1. Auth APIs

### `POST /auth/register`
- Parameters: Body `{ organization_name, email, password }`
- How to use: Create a new organization admin. Password must be strong. Response returns auth payload and also sets admin auth cookies.

### `POST /auth/login`
- Parameters: Body `{ email, password, organization_id?, organization_subdomain?, organization_domain? }`
- How to use: Admin/staff login. On tenant subdomains or custom domains, backend binds login to the request host. On shared/root login screens, FE can provide organization context when needed. If 2FA is disabled, response returns auth payload and also sets admin auth cookies. If 2FA is enabled, response returns `{ requires_two_factor: true, challenge_token, challenge_expires_in, user }` and FE must call `POST /auth/2fa/verify-login` before treating the session as authenticated.

### `POST /auth/2fa/verify-login`
- Status: New
- Parameters: Body `{ challenge_token, code?, recovery_code? }`
- How to use: Complete the second step of an admin/staff login. FE should send the six-digit authenticator code or one recovery code. Successful response returns auth payload and sets admin auth cookies.

### `POST /auth/invite`
- Parameters: Auth required. Body `{ first_name, last_name, email }`
- How to use: Admin invites a staff user. Backend creates pending invitation and sends invite email.

### `POST /auth/accept-invite`
- Parameters: Body `{ token, password }`
- How to use: Staff accepts invitation from email flow.

### `POST /auth/refresh`
- Parameters: Body `{ refresh_token? }`
- How to use: FE can call this with a refresh token in body or with cookie-only session. Backend returns fresh auth payload and resets cookies.

### `POST /auth/password-reset/request`
- Parameters: Body `{ email }`
- How to use: Forgot-password request. Response is generic and does not reveal whether user exists.

### `POST /auth/password-reset/confirm`
- Parameters: Body `{ token, password }`
- How to use: Complete password reset after email link is opened.

### `POST /auth/organization-email/verify`
- Parameters: Body `{ token }`
- How to use: Verify organization email from email link.

### `POST /auth/organization-email/request-verification`
- Parameters: Auth required
- How to use: Re-send organization email verification from settings UI.

### `GET /auth/organization-email/status`
- Status: New
- Parameters: Auth required
- How to use: Fetch current organization email verification state for FE settings screens.

### `POST /auth/logout`
- Parameters: Auth required
- How to use: Clears backend auth cookies and invalidates refresh state.

### `GET /auth/profile`
- Parameters: Auth required
- How to use: Fetch current admin/staff profile.

### `PATCH /auth/profile`
- Parameters: Auth required. Body `{ first_name?, middle_name?, last_name?, title?, designation? }`
- How to use: Update current admin/staff profile.

### `GET /auth/me`
- Parameters: Auth required
- How to use: FE app bootstrap endpoint for current admin/staff session.

### `GET /auth/2fa/status`
- Status: New
- Parameters: Auth required
- How to use: Fetch current 2FA state for the authenticated admin/staff user. Response includes `enabled`, `setup_pending`, and `recovery_codes_remaining`.

### `POST /auth/2fa/setup`
- Status: New
- Parameters: Auth required
- How to use: Start 2FA enrollment for the authenticated admin/staff user. Response returns `secret`, `manual_entry_key`, `otpauth_url`, and `expires_at`. FE should render the secret as a QR code or show the manual key.

### `POST /auth/2fa/enable`
- Status: New
- Parameters: Auth required. Body `{ code }`
- How to use: Confirm the authenticator app pairing using the current six-digit code. Response returns `recovery_codes`; FE should show them once and require the user to save them.

### `POST /auth/2fa/disable`
- Status: New
- Parameters: Auth required. Body `{ code? , recovery_code? }`
- How to use: Disable 2FA for the authenticated admin/staff user. FE must send either a current authenticator code or an unused recovery code.

### `POST /auth/2fa/recovery-codes/regenerate`
- Status: New
- Parameters: Auth required. Body `{ code? , recovery_code? }`
- How to use: Replace all existing recovery codes after verifying the current user with either a live authenticator code or an unused recovery code.

## 2. Organization APIs

### `GET /organization`
- Parameters: Auth required
- How to use: Fetch full organization record for dashboard bootstrap.

### `PATCH /organization`
- Parameters: Auth required. Body `{ name?, email?, subdomain?, custom_domain?, require_contact_login?, notify_submission_confirmation?, notify_payment_confirmation?, notify_payment_failure?, partial_payment_limit? }`
- How to use: Update organization settings including tenant host fields and notification preferences.

### `GET /organization/settings`
- Parameters: Auth required
- How to use: Fetch settings-focused organization payload.

### `PATCH /organization/settings`
- Parameters: Auth required. Body uses same settings fields as `PATCH /organization`.
- How to use: Update settings screen values without using broader org update flow.

### `PATCH /organization/keys`
- Parameters: Auth required. Body `{ paystack_public_key?, paystack_secret_key?, paystack_webhook_url? }`
- How to use: Store organization-owned Paystack credentials and optional webhook URL.

### `POST /organization/logo`
- Parameters: Auth required. Body `{ logo_url }`
- How to use: Persist uploaded logo URL after FE storage upload is complete.

## 3. Form APIs

### `POST /forms`
- Parameters: Auth required. Body `{ title, category?, description?, note?, slug, payment_type, amount?, allow_partial, access_mode?, identity_validation_mode?, identity_field_label? }`
- How to use: Create a new form. `payment_type` is `FIXED | VARIABLE`. `access_mode` is `OPEN | LOGIN_REQUIRED | TARGETED_ONLY`. `identity_validation_mode` is `NONE | CONTACT_EMAIL | CONTACT_EXTERNAL_ID`.

### `GET /forms`
- Parameters: Auth required. Query `page?`, `limit?`
- How to use: List forms in dashboard.

### `GET /forms/:id`
- Parameters: Auth required. Path `id`
- How to use: Load one form for edit/view.

### `PATCH /forms/:id`
- Parameters: Auth required. Path `id`. Body `{ title?, category?, description?, note?, is_active?, amount?, allow_partial?, access_mode?, identity_validation_mode?, identity_field_label? }`
- How to use: Update form metadata, payment rules, and access rules.

### `DELETE /forms/:id`
- Parameters: Auth required. Path `id`
- How to use: Delete a form.

### `POST /forms/:id/fields`
- Parameters: Auth required. Path `id`. Body `{ label, type, required, options?, order_index?, validation_rules? }`
- How to use: Add a form field. `type` is `TEXT | EMAIL | SELECT | NUMBER | TEXTAREA`.

### `PATCH /forms/fields/:fieldId`
- Parameters: Auth required. Path `fieldId`. Body `{ label?, type?, required?, options?, validation_rules? }`
- How to use: Update one form field.

### `DELETE /forms/fields/:fieldId`
- Parameters: Auth required. Path `fieldId`
- How to use: Delete one form field.

### `PATCH /forms/:id/fields/reorder`
- Parameters: Auth required. Path `id`. Body `{ fields: [{ id, order_index }] }`
- How to use: Persist FE drag-and-drop field ordering.

### `POST /forms/:id/groups`
- Parameters: Auth required. Path `id`. Body `{ group_ids: string[] }`
- How to use: Attach groups directly to a form.

### `GET /forms/:id/groups`
- Status: New
- Parameters: Auth required. Path `id`
- How to use: Fetch only the groups currently attached to a form.

### `GET /forms/:id/targets`
- Parameters: Auth required. Path `id`
- How to use: Fetch current visibility targets for form assignment UI.

### `POST /forms/:id/targets`
- Parameters: Auth required. Path `id`. Body `{ target_type, target_ids }`
- How to use: Add contact or group targets. `target_type` is `group | contact`.

### `DELETE /forms/:id/targets/:targetId`
- Parameters: Auth required. Path `id`, `targetId`
- How to use: Remove a single target assignment.

## 4. Group APIs

### `POST /groups`
- Parameters: Auth required. Body `{ name, description?, note?, parent_group_id? }`
- How to use: Create group or subgroup.

### `GET /groups`
- Parameters: Auth required. Query `page?`, `limit?`
- How to use: List groups with pagination.

### `GET /groups/tree`
- Parameters: Auth required
- How to use: Fetch nested group tree for FE tree controls.

### `GET /groups/:id`
- Parameters: Auth required. Path `id`
- How to use: Fetch one group.

### `PATCH /groups/:id`
- Parameters: Auth required. Path `id`. Body `{ name?, description?, note?, parent_group_id? }`
- How to use: Update group metadata or move it to another parent.

### `PATCH /groups/:id/detach`
- Status: New
- Parameters: Auth required. Path `id`
- How to use: Remove a group from its parent without deleting the group.

### `DELETE /groups/:id`
- Parameters: Auth required. Path `id`
- How to use: Delete a group.

### `POST /groups/:id/contacts`
- Parameters: Auth required. Path `id`. Body `{ contact_ids: string[] }`
- How to use: Add contacts to a group.

### `DELETE /groups/:id/contacts`
- Status: New
- Parameters: Auth required. Path `id`. Body `{ contact_ids: string[] }`
- How to use: Remove selected contacts from a group.

### `GET /groups/:id/contacts`
- Parameters: Auth required. Path `id`. Query `page?`, `limit?`
- How to use: List contacts for the group and all nested subgroups.

## 5. Contact APIs

### `POST /contacts`
- Parameters: Auth required. Body `{ first_name?, middle_name?, last_name?, email, phone?, gender?, student_id?, external_id?, guardian_name?, guardian_email?, guardian_phone?, require_login?, must_reset_password? }`
- How to use: Create a single contact. Password setup email is sent automatically when required.

### `GET /contacts`
- Parameters: Auth required. Query `{ group_id?, student_id?, last_name?, first_name?, email?, external_id?, page?, limit? }`
- How to use: Filter and list contacts.

### `GET /contacts/export`
- Parameters: Auth required. Query `group_id?`
- How to use: Download contacts CSV.

### `GET /contacts/:id`
- Parameters: Auth required. Path `id`
- How to use: Fetch one contact record.

### `GET /contacts/:id/details`
- Parameters: Auth required. Path `id`
- How to use: Fetch one contact plus resolved `group_hierarchy` paths for FE context displays.

### `PATCH /contacts/:id`
- Parameters: Auth required. Path `id`. Body `{ first_name?, middle_name?, last_name?, email?, phone?, gender?, student_id?, external_id?, guardian_name?, guardian_email?, guardian_phone?, is_active? }`
- How to use: Update contact details or active state.

### `DELETE /contacts/:id`
- Parameters: Auth required. Path `id`
- How to use: Delete one contact.

### `POST /contacts/import`
- Parameters: Auth required. Body `{ contacts: ContactImportRowDto[] }`
- How to use: Direct JSON import for immediate bulk contact creation. Rows can include `group_ids`, `groups`, `group_paths`, `require_login`, `is_active`, and `must_reset_password`.

### `POST /contacts/imports/validate`
- Parameters: Auth required. Body `{ contacts: ContactImportRowDto[] }`
- How to use: Validate JSON import before commit.

### `POST /contacts/imports/csv/validate`
- Status: New
- Parameters: Auth required. Body `{ csv }`
- How to use: Validate raw CSV import.

### `POST /contacts/imports/:id/commit`
- Parameters: Auth required. Path `id`
- How to use: Commit a previously validated import job.

### `POST /contacts/imports/csv/commit`
- Status: New
- Parameters: Auth required. Body `{ csv }`
- How to use: Validate and commit a CSV import in one request.

### `GET /contacts/imports`
- Parameters: Auth required. Query `page?`, `limit?`
- How to use: List import history.

### `GET /contacts/imports/:id`
- Parameters: Auth required. Path `id`
- How to use: Fetch one import job record.

### `GET /contacts/:id/transactions`
- Parameters: Auth required. Path `id`. Query `page?`, `limit?`, `format?=csv`
- How to use: List one contact's transactions or export them as CSV.

### `POST /contacts/:id/groups`
- Parameters: Auth required. Path `id`. Body `{ group_ids: string[] }`
- How to use: Assign groups to a contact.

## 6. Contact Auth APIs

### `POST /contact-auth/login`
- Parameters: Body `{ email, password, organization_id?, organization_subdomain?, organization_domain? }`
- How to use: Contact login. On tenant subdomains or custom domains, backend treats the request host as authoritative tenant context and rejects unknown or mismatched organization context. Returns auth payload and sets contact cookie.

### `POST /contact-auth/set-password`
- Parameters: Body `{ token, password }`
- How to use: First-time password setup for contacts.

### `POST /contact-auth/reset/request`
- Parameters: Body `{ email, organization_id?, organization_subdomain?, organization_domain? }`
- How to use: Contact forgot-password request.

### `POST /contact-auth/password-reset/request`
- Parameters: Same as `/contact-auth/reset/request`
- How to use: Compatibility alias.

### `POST /contact-auth/reset/confirm`
- Parameters: Body `{ token, password }`
- How to use: Complete contact password reset.

### `POST /contact-auth/password-reset/confirm`
- Parameters: Same as `/contact-auth/reset/confirm`
- How to use: Compatibility alias.

### `POST /contact-auth/logout`
- Status: New
- Parameters: Auth required
- How to use: Clear contact auth cookie/session.

### `GET /contact-auth/me`
- Parameters: Auth required
- How to use: Fetch authenticated contact profile. Successful requests are now safely audit-logged with contact actor support.

### `GET /contact-auth/transactions`
- Status: New
- Parameters: Auth required. Query `{ page?, limit?, format?=csv }`
- How to use: Fetch the authenticated contact's own transaction history without admin auth. When `format=csv`, backend returns a CSV export for only that contact's transactions.

### `GET /contact-auth/payments/:id/receipt`
- Parameters: Auth required. Path `id`
- How to use: Download a styled PDF receipt for the authenticated contact's payment. Receipt now shows the form name instead of form ID, no longer exposes submission ID, and includes payment method plus offline confirmation details when available.

### `GET /contact-auth/payments/reference/:reference/receipt`
- Parameters: Auth required. Path `reference`
- How to use: Download a styled PDF receipt by payment reference. Receipt now shows the form name instead of form ID, no longer exposes submission ID, and includes payment method plus offline confirmation details when available.

## 7. Payment APIs

### `GET /payments`
- Parameters: Auth required. Query `page?`, `limit?`, `format?=csv`
- How to use: List payments or export payments CSV.

### `GET /payments/:id`
- Parameters: Auth required. Path `id`
- How to use: Fetch one payment record.

### `GET /payments/verify/:reference`
- Parameters: Auth required. Path `reference`
- How to use: Manually verify and finalize a payment against Paystack.

### `POST /payments`
- Parameters: Auth required. Body `{ submission_id, amount, total_amount?, reference?, payment_method? }`
- How to use: Create a payment record manually or internally.

### `POST /payments/:id/status`
### `PATCH /payments/:id/status`
- Parameters: Auth required. Body `{ status, paid_at?, amount_paid?, payment_method?, confirmation_note?, external_reference? }`
- How to use: Admin-only manual payment status update. `status` is `PENDING | PAID | PARTIAL | FAILED`. Use the dedicated offline-review route when confirming offline payments with review metadata.

### `GET /payments/:id/receipt`
- Parameters: Auth required. Path `id`
- How to use: Download a PDF receipt for a payment record from admin/staff context. Receipt includes payment method and, for offline reviews, the confirmation timestamp, confirmer, note, and external reference.

### `GET /payments/reference/:reference/receipt`
- Parameters: Auth required. Path `reference`
- How to use: Download a PDF receipt by payment reference from admin/staff context. Receipt includes payment method and offline confirmation metadata when present.

### `GET /payments/offline/pending`
- Status: New
- Parameters: Admin auth required. Query `page?`, `limit?`, `form_id?`, `contact_id?`, `payment_method?`, `start_date?`, `end_date?`
- How to use: Fetch the pending offline-payment review queue. Returns only non-`ONLINE` payments still in `PENDING` status, including submission/contact context for review screens.

### `POST /payments/:id/offline-review`
### `PATCH /payments/:id/offline-review`
- Status: New
- Parameters: Admin auth required. Path `id`. Body `{ status, paid_at?, amount_paid?, payment_method?, confirmation_note?, external_reference? }`
- How to use: Confirm or reject an offline payment without changing the online Paystack flow. Use `status=PAID` or `PARTIAL` to confirm, or `status=FAILED` to reject. Backend stamps confirmation metadata automatically.

## 8. Transaction APIs

### `GET /transactions`
- Parameters: Auth required. Query `{ status?, reference?, form_id?, contact_id?, payment_method?, start_date?, end_date?, page?, limit?, format? }`
- How to use: Filter transaction history and optionally export CSV with `format=csv`. The CSV returns `reference, amount, payment_method, status, paid_at, created_at, form_name, contact_name`.

### `GET /transactions/:id`
- Parameters: Auth required. Path `id`
- How to use: Fetch one transaction/payment detail.

### `GET /transactions/:id/history`
- Parameters: Auth required. Path `id`. Query `page?`, `limit?`
- How to use: Fetch payment lifecycle/event history.

## 9. Submission Admin API

### `GET /submissions/export`
- Status: New
- Parameters: Auth required. Query `{ format?, form_id?, contact_id?, start_date?, end_date?, page?, limit? }`
- How to use: Export filtered submissions as CSV or PDF.

## 10. Public Form APIs

### `GET /public/forms/:slug`
- Parameters: Path `slug`. Optional header `Authorization: Bearer <contact token>`
- How to use: Load public form definition by slug.

### `GET /public/forms/:slug/widget-config`
- Parameters: Path `slug`. Optional contact auth header
- How to use: Fetch widget bootstrap config for embed flows.

### `GET /public/forms/:slug/embed.js`
- Parameters: Path `slug`. Supported script attributes: `data-callback-url?`, `data-api-base?`, `data-contact-token?`, `data-contact-email?`, `data-contact-name?`, `data-width?`, `data-height?`, `data-min-height?`, `data-auto-redirect?`, `data-container?`
- How to use: Include as external script to render embeddable widget.

### `GET /public/forms/:slug/widget`
- Parameters: Path `slug`. Query `{ callback_url?, contact_token?, contact_email?, contact_name?, auto_redirect? }`
- How to use: Load iframe-ready widget HTML.

### `POST /public/forms/:slug/submit`
- Parameters: Path `slug`. Query `callback_url?`. Optional contact auth header. Body `{ data, contact_email?, contact_name?, partial_amount?, payment_method? }`
- How to use: Submit public form. FE should handle three outcomes: direct success for free forms, Paystack authorization response for `payment_method=ONLINE`, or `offline_payment=true` response for offline methods (`CASH`, `BANK_TRANSFER`, `POS`, `CHEQUE`) that remain pending until admin confirmation.

### `GET /public/payments/callback`
- Parameters: Query `reference?`, `trxref?`
- How to use: Backend callback endpoint for Paystack redirect. FE normally should not call it directly.

### `GET /public/payments/verify`
- Status: New
- Parameters: Query `reference?`, `trxref?`
- How to use: Public JSON verification endpoint.

## 11. Notification APIs

### `POST /notifications/reminder`
- Parameters: Auth required. `multipart/form-data` with `contact_ids`, `message?`, `attachment?`
- How to use: Send reminder to selected contacts. `contact_ids` can be sent as a JSON array string or repeated form field values. Optional `attachment` supports one file up to 10MB and is included in the reminder email.

### `POST /notifications/reminder/groups`
- Parameters: Auth required. `multipart/form-data` with `group_ids`, `message?`, `attachment?`
- How to use: Send reminder to contacts resolved from selected groups. `group_ids` can be sent as a JSON array string or repeated form field values. Optional `attachment` supports one file up to 10MB and is included in the reminder email.

### `POST /notifications/schedule`
- Parameters: Auth required. Body `{ subject, body, recipients: string[] }`
- How to use: Current MVP sends immediately rather than storing future schedule.

### `POST /notifications/schedule/groups`
- Parameters: Auth required. Body `{ subject, body, group_ids: string[] }`
- How to use: Current MVP resolves group contacts and sends immediately.

### `GET /notifications/scheduled`
- Status: New
- Parameters: Auth required. Query `page?`, `limit?`
- How to use: Returns empty paginated shape for now because real scheduling is not implemented yet.

### `POST /notifications/internal`
- Status: New
- Parameters: Auth required. Body `{ title, body, user_ids? }`
- How to use: Create an in-app internal notification for all organization users or selected admin/staff users.

### `GET /notifications/internal`
- Status: New
- Parameters: Auth required. Query `page?`, `limit?`, `unread_only?=true|false`
- How to use: List internal notifications visible to the authenticated admin/staff user.

### `PATCH /notifications/internal/:id/read`
- Status: New
- Parameters: Auth required. Path `id`
- How to use: Mark one internal notification as read for the authenticated admin/staff user.

## 12. Audit APIs

### `GET /audit/logs`
- Parameters: Auth required. Query `{ page?, limit?, action?, entity_type?, entity_id?, user_id?, contact_id?, ip_address?, user_agent?, keyword?, from?, to? }`
- How to use: Admin-only activity log filtering. Response actor data can now resolve admin/staff users, authenticated contacts, or system actions.

### `GET /audit/payment-logs/:payment_id`
- Parameters: Auth required. Path `payment_id`. Query `{ page?, limit?, event?, event_id?, keyword?, from?, to? }`
- How to use: Admin-only payment audit trail filtering.

## 13. Report APIs

### `GET /reports/summary`
- Parameters: Auth required. Query `start_date?`, `end_date?`
- How to use: Fetch dashboard summary metrics.

### `GET /reports/analytics`
- Parameters: Auth required. Query `start_date?`, `end_date?`
- How to use: Fetch analytics data and payment status aggregates.

### `GET /reports/forms/performance`
- Status: New
- Parameters: Auth required. Query `start_date?`, `end_date?`
- How to use: Fetch per-form performance and conversion metrics.

### `GET /reports/forms/:formId/submission-summary`
- Status: New
- Parameters: Auth required. Path `formId`. Query `start_date?`, `end_date?`
- How to use: Fetch one form's submission source totals, payment breakdown, and field-level response summaries for both registered contacts and public users.

### `GET /reports/groups/contributions`
- Status: New
- Parameters: Auth required. Query `form_id?`, `start_date?`, `end_date?`
- How to use: Fetch group-level contribution metrics.

### `GET /reports/export`
- Parameters: Auth required. Query `{ type?=summary|analytics, format?=csv|pdf, start_date?, end_date? }`
- How to use: Export summary or analytics report.

## 14. Webhook API

### `POST /webhooks/paystack`
- Parameters: Header `x-paystack-signature`, raw Paystack body
- How to use: Used by Paystack only. FE should not call this route.

## 15. Health APIs

### `GET /health`
- Parameters: None
- How to use: Basic service health check.

### `GET /health/ready`
- Parameters: None
- How to use: Readiness probe for deploy/load balancer checks.

## 16. Billing APIs

### `GET /billing/plans/:organizationId`
- Parameters: Path `organizationId`
- How to use: Fetch billing plan for one organization.

### `GET /billing/usage/:organizationId`
- Parameters: Path `organizationId`
- How to use: Fetch current usage metrics for one organization.

### `GET /billing/report/:organizationId`
- Parameters: Path `organizationId`
- How to use: Fetch usage/billing report.

### `POST /billing/upgrade/:organizationId`
- Parameters: Path `organizationId`. Body `{ newPlanTier }`
- How to use: Upgrade organization billing plan.

## 17. Compliance APIs

### `POST /compliance/export`
- Parameters: Auth required. Body `{ contactId }`
- How to use: Create a data export request for one contact. Backend derives organization and requester from the authenticated admin.

### `POST /compliance/delete`
- Parameters: Auth required. Body `{ contactId }`
- How to use: Create a data deletion request for one contact. Backend derives organization and requester from the authenticated admin.

### `GET /compliance/export/:contactId/:organizationId`
- Parameters: Path `contactId`, `organizationId`
- How to use: Fetch exported contact data payload.

### `GET /compliance/retention-policy/:organizationId`
- Parameters: Path `organizationId`
- How to use: Fetch retention policy.

### `POST /compliance/retention-policy/:organizationId`
- Parameters: Path `organizationId`. Body `policy object`
- How to use: Update retention policy.

### `POST /compliance/purge/:organizationId`
- Parameters: Path `organizationId`
- How to use: Trigger retention purge.

### `GET /compliance/audit-trail/:organizationId`
- Parameters: Path `organizationId`
- How to use: Fetch compliance audit trail.