# Payforms API Usage Workflows

This document explains how FE should use the current backend APIs in real product flows.

For each workflow below, FE gets:
- the endpoint(s) involved
- the parameters to send
- how to use the route in sequence
- whether the route is new or updated where relevant

## What Changed For FE

### New workflows/endpoints

- Submission export via `GET /submissions/export`
- Group detach via `PATCH /groups/:id/detach`
- Group contact removal via `DELETE /groups/:id/contacts`
- Form group fetch via `GET /forms/:id/groups`
- Organization email verification status via `GET /auth/organization-email/status`
- Contact logout via `POST /contact-auth/logout`
- CSV contact import validate and commit endpoints
- Public payment verify via `GET /public/payments/verify`
- Scheduled notifications listing via `GET /notifications/scheduled`
- Internal notification create/list/read endpoints
- Form performance and group contribution reports

### Updated workflows/endpoints

- Admin auth now supports cookie-backed sessions in addition to token responses.
- Contact auth now supports cookie-backed session.
- Public form submit now supports both free forms and partial payments.
- Notification fan-out now sends per recipient, so recipient emails are no longer exposed to each other.

## 1. Admin Authentication Workflow

### 1.1 Register organization admin

- Endpoint: `POST /auth/register`
- Parameters: Body `{ organization_name, email, password }`
- How to use:
  1. FE submits org signup form.
  2. Backend returns auth payload and sets auth cookies.
  3. FE should store returned access token in memory only if needed, then bootstrap current user with `/auth/me`.

### 1.2 Login admin or staff

- Endpoint: `POST /auth/login`
- Parameters: Body `{ email, password, organization_id?, organization_subdomain?, organization_domain? }`
- How to use:
  1. FE submits login form.
  2. On tenant subdomains or custom domains, backend binds login to the request host and rejects mismatched organization context.
  3. On shared/root login screens, FE can provide organization context when the same email may exist in more than one organization.
  4. Backend validates credentials, returns auth payload, and sets cookies.
  5. FE should then fetch `/auth/me` or `/auth/profile`.

### 1.3 Refresh session

- Endpoint: `POST /auth/refresh`
- Parameters: Body `{ refresh_token? }`
- How to use:
  1. FE calls refresh when session expires or on 401.
  2. In cookie-backed mode, FE can send empty body.
  3. Backend refreshes access token and cookies.

### 1.4 Logout

- Endpoint: `POST /auth/logout`
- Parameters: Auth required
- How to use:
  1. FE calls logout.
  2. Backend clears cookies and invalidates refresh token state.
  3. FE clears in-memory auth state and redirects to login.

## 2. Admin Account Recovery Workflow

### 2.1 Request password reset

- Endpoint: `POST /auth/password-reset/request`
- Parameters: Body `{ email }`
- How to use:
  1. FE submits forgot-password email.
  2. Backend responds with a generic success message.
  3. FE always shows a neutral confirmation state.

### 2.2 Confirm password reset

- Endpoint: `POST /auth/password-reset/confirm`
- Parameters: Body `{ token, password }`
- How to use:
  1. FE reads token from reset link.
  2. FE submits token and new password.
  3. Backend updates password.

## 3. Organization Settings Workflow

### 3.1 Load organization settings

- Endpoints:
  - `GET /organization`
  - `GET /organization/settings`
- Parameters: Auth required
- How to use:
  1. Use `/organization` for full dashboard bootstrap.
  2. Use `/organization/settings` for settings-only screens.

### 3.2 Update organization settings

- Endpoint: `PATCH /organization`
- Parameters: Body `{ name?, email?, subdomain?, custom_domain?, require_contact_login?, notify_submission_confirmation?, notify_payment_confirmation?, notify_payment_failure?, partial_payment_limit? }`
- How to use:
  1. FE submits settings changes.
  2. Backend persists tenant settings and notification settings.

### 3.3 Update payment keys

- Endpoint: `PATCH /organization/keys`
- Parameters: Body `{ paystack_public_key?, paystack_secret_key?, paystack_webhook_url? }`
- How to use:
  1. FE submits Paystack keys from admin settings.
  2. Backend stores org-specific gateway credentials.

### 3.4 Verify organization email

- Endpoints:
  - `POST /auth/organization-email/request-verification`
  - `POST /auth/organization-email/verify`
  - `GET /auth/organization-email/status` `New`
- Parameters:
  - Request verification: auth required
  - Verify: Body `{ token }`
  - Status: auth required
- How to use:
  1. FE requests verification email from settings.
  2. User opens email link.
  3. FE submits verification token.
  4. FE can poll or fetch status with `/auth/organization-email/status`.

## 4. Form Builder Workflow

### 4.1 Create form

- Endpoint: `POST /forms`
- Parameters: Body `{ title, category?, description?, note?, slug, payment_type, amount?, allow_partial, access_mode?, identity_validation_mode?, identity_field_label? }`
- How to use:
  1. FE submits form definition.
  2. Backend creates form.
  3. FE can then add fields and targets.

### 4.2 Manage fields

- Endpoints:
  - `POST /forms/:id/fields`
  - `PATCH /forms/fields/:fieldId`
  - `DELETE /forms/fields/:fieldId`
  - `PATCH /forms/:id/fields/reorder`
- Parameters:
  - Create field body `{ label, type, required, options?, order_index?, validation_rules? }`
  - Update field body `{ label?, type?, required?, options?, validation_rules? }`
  - Reorder body `{ fields: [{ id, order_index }] }`
- How to use:
  1. FE adds, updates, deletes, and reorders fields in builder UI.
  2. Backend persists field configuration.

### 4.3 Manage form targeting

- Endpoints:
  - `POST /forms/:id/groups`
  - `GET /forms/:id/groups` `New`
  - `GET /forms/:id/targets`
  - `POST /forms/:id/targets`
  - `DELETE /forms/:id/targets/:targetId`
- Parameters:
  - Assign groups body `{ group_ids: string[] }`
  - Assign targets body `{ target_type, target_ids }`
- How to use:
  1. FE can attach groups directly or use target assignments.
  2. Use `/forms/:id/groups` when only group assignment data is needed.
  3. Use `/forms/:id/targets` for richer visibility target management.

## 5. Group Management Workflow

### 5.1 Create, update, and list groups

- Endpoints:
  - `POST /groups`
  - `GET /groups`
  - `GET /groups/tree`
  - `GET /groups/:id`
  - `PATCH /groups/:id`
  - `DELETE /groups/:id`
- Parameters:
  - Create/update body `{ name, description?, note?, parent_group_id? }`
  - List query `page?`, `limit?`
- How to use:
  1. FE uses `/groups/tree` for nested UI.
  2. FE uses `/groups` for flat paginated tables.

### 5.2 Detach subgroup from parent

- Endpoint: `PATCH /groups/:id/detach` `New`
- Parameters: Path `id`
- How to use:
  1. FE calls this when admin wants to keep subgroup but remove parent relationship.

### 5.3 Add or remove contacts from group

- Endpoints:
  - `POST /groups/:id/contacts`
  - `DELETE /groups/:id/contacts` `New`
  - `GET /groups/:id/contacts`
- Parameters:
  - Add/remove body `{ contact_ids: string[] }`
  - List query `page?`, `limit?`
- How to use:
  1. FE can manage membership from the group side.
  2. Group contact list includes contacts in subgroups too.

## 6. Contact Management Workflow

### 6.1 Create and edit contacts

- Endpoints:
  - `POST /contacts`
  - `GET /contacts`
  - `GET /contacts/:id`
  - `GET /contacts/:id/details`
  - `PATCH /contacts/:id`
  - `DELETE /contacts/:id`
  - `POST /contacts/:id/groups`
- Parameters:
  - Create body `{ first_name?, middle_name?, last_name?, email, phone?, gender?, student_id?, external_id?, guardian_name?, guardian_email?, guardian_phone?, require_login?, must_reset_password? }`
  - Update body `{ first_name?, middle_name?, last_name?, email?, phone?, gender?, student_id?, external_id?, guardian_name?, guardian_email?, guardian_phone?, is_active? }`
  - List query `{ group_id?, student_id?, last_name?, first_name?, email?, external_id?, page?, limit? }`
  - Assign groups body `{ group_ids: string[] }`
- How to use:
  1. Use `/contacts` for normal listing/filtering.
  2. Use `/contacts/:id/details` when FE needs group hierarchy paths.
  3. Use `/contacts/:id/groups` to assign group membership directly.

### 6.2 Export contacts

- Endpoint: `GET /contacts/export`
- Parameters: Query `group_id?`
- How to use:
  1. FE triggers download for CSV export.

### 6.3 Contact transaction history

- Endpoint: `GET /contacts/:id/transactions`
- Parameters: Query `page?`, `limit?`, `format?=csv`
- How to use:
  1. FE shows per-contact transaction history.
  2. Use `format=csv` to export it.

## 7. Contact Import Workflow

### 7.1 Direct JSON import

- Endpoint: `POST /contacts/import`
- Parameters: Body `{ contacts: ContactImportRowDto[] }`
- How to use:
  1. FE submits parsed JSON rows directly.
  2. Backend imports immediately and sends password setup emails where required.

### 7.2 Validate then commit JSON import

- Endpoints:
  - `POST /contacts/imports/validate`
  - `POST /contacts/imports/:id/commit`
  - `GET /contacts/imports`
  - `GET /contacts/imports/:id`
- Parameters:
  - Validate body `{ contacts: ContactImportRowDto[] }`
  - Commit path `id`
- How to use:
  1. FE validates import first.
  2. Backend returns import job.
  3. FE commits validated job.
  4. FE can load import history and detail screens.

### 7.3 Validate and commit CSV import

- Endpoints:
  - `POST /contacts/imports/csv/validate` `New`
  - `POST /contacts/imports/csv/commit` `New`
- Parameters: Body `{ csv }`
- How to use:
  1. FE uploads or pastes raw CSV.
  2. Use validate for preview flow.
  3. Use commit for one-step CSV import flow.

## 8. Contact Authentication Workflow

### 8.1 Contact login

- Endpoint: `POST /contact-auth/login`
- Parameters: Body `{ email, password, organization_id?, organization_subdomain?, organization_domain? }`
- How to use:
  1. FE submits contact login.
  2. On tenant subdomains or custom domains, backend treats request host as authoritative tenant context.
  3. Backend rejects unknown subdomains and host/context mismatches.
  4. Backend returns auth payload and sets contact auth cookie.

### 8.2 Contact logout

- Endpoint: `POST /contact-auth/logout` `New`
- Parameters: Auth required
- How to use:
  1. FE calls logout when contact signs out.
  2. Backend clears contact auth cookie.

### 8.3 Set password and reset password

- Endpoints:
  - `POST /contact-auth/set-password`
  - `POST /contact-auth/reset/request`
  - `POST /contact-auth/reset/confirm`
  - `POST /contact-auth/password-reset/request`
  - `POST /contact-auth/password-reset/confirm`
- Parameters:
  - Set password body `{ token, password }`
  - Reset request body `{ email, organization_id?, organization_subdomain?, organization_domain? }`
  - Reset confirm body `{ token, password }`
- How to use:
  1. Use `/set-password` for first-time setup.
  2. Use `/reset/*` or `/password-reset/*` for recovery flow.

### 8.4 Contact self-service APIs

- Endpoints:
  - `GET /contact-auth/me`
  - `GET /contact-auth/payments/:id/receipt`
  - `GET /contact-auth/payments/reference/:reference/receipt`
- Parameters: Auth required
- How to use:
  1. `/me` loads contact profile.
  2. Receipt endpoints download PDF receipts.

## 9. Public Form Workflow

### 9.1 Load public form and widget assets

- Endpoints:
  - `GET /public/forms/:slug`
  - `GET /public/forms/:slug/widget-config`
  - `GET /public/forms/:slug/embed.js`
  - `GET /public/forms/:slug/widget`
- Parameters:
  - `:slug`
  - Widget query `{ callback_url?, contact_token?, contact_email?, contact_name?, auto_redirect? }`
  - Optional contact bearer token for targeted forms
- How to use:
  1. FE can load a normal public page from `/public/forms/:slug`.
  2. Embedded flows should bootstrap from `/widget-config` or `/embed.js`.
  3. Targeted forms can pass contact auth.

### 9.2 Submit public form

- Endpoint: `POST /public/forms/:slug/submit`
- Status: Updated
- Parameters:
  - Query `callback_url?`
  - Body `{ data, contact_email?, contact_name?, partial_amount? }`
  - Optional contact bearer token for targeted forms
- How to use:
  1. FE posts submission payload.
  2. If form is free, backend returns direct success flow.
  3. If payment is required, backend returns Paystack authorization flow.
  4. If partial payment is allowed, FE may pass `partial_amount`.

### 9.3 Handle payment verification after Paystack

- Endpoints:
  - `GET /public/payments/callback`
  - `GET /public/payments/verify` `New`
- Parameters:
  - Query `reference?`, `trxref?`
- How to use:
  1. Paystack returns to callback endpoint.
  2. Backend verifies and redirects to FE success page.
  3. FE may also use `/public/payments/verify` when it needs JSON verification only.

## 10. Payment and Transaction Workflow

### 10.1 Payment list and detail

- Endpoints:
  - `GET /payments`
  - `GET /payments/:id`
  - `GET /payments/verify/:reference`
  - `POST /payments`
  - `POST /payments/:id/status`
  - `PATCH /payments/:id/status`
- Parameters:
  - List query `page?`, `limit?`, `format?=csv`
  - Create body `{ submission_id, amount, total_amount?, reference? }`
  - Update status body `{ status, paid_at?, amount_paid? }`
- How to use:
  1. FE uses `/payments` for admin payment table and CSV export.
  2. Use `/payments/verify/:reference` for manual verification actions.
  3. Use status update only for admin override flows.

### 10.2 Transaction history

- Endpoints:
  - `GET /transactions`
  - `GET /transactions/:id`
  - `GET /transactions/:id/history`
- Parameters:
  - List query `{ status?, reference?, form_id?, contact_id?, start_date?, end_date?, page?, limit?, format? }`
- How to use:
  1. FE uses `/transactions` for filtered history and export.
  2. When `format=csv`, backend returns `reference, amount, status, paid_at, created_at, form_name, contact_name` only.
  3. FE uses `/transactions/:id/history` for event timeline UI.

## 11. Submission Export Workflow

### 11.1 Export raw submissions

- Endpoint: `GET /submissions/export` `New`
- Parameters: Query `{ format?, form_id?, contact_id?, start_date?, end_date?, page?, limit? }`
- How to use:
  1. FE builds export filter UI.
  2. FE calls export endpoint with `format=csv` or `format=pdf`.
  3. Backend returns downloadable file.

## 12. Notifications Workflow

### 12.1 Send reminder to specific contacts

- Endpoint: `POST /notifications/reminder`
- Parameters: `multipart/form-data` with `contact_ids`, `message?`, `attachment?`
- How to use:
  1. FE selects contacts.
  2. FE submits `contact_ids` as either repeated form-data fields or a JSON array string.
  3. FE may include one optional attachment file up to 10MB.
  4. Backend resolves emails and sends reminders with the attachment included in the email.

### 12.2 Send reminder by groups

- Endpoint: `POST /notifications/reminder/groups`
- Parameters: `multipart/form-data` with `group_ids`, `message?`, `attachment?`
- How to use:
  1. FE selects groups.
  2. FE submits `group_ids` as either repeated form-data fields or a JSON array string.
  3. FE may include one optional attachment file up to 10MB.
  4. Backend resolves all group contact emails and sends reminders with the attachment included in the email.

### 12.3 Send immediate scheduled messages

- Endpoints:
  - `POST /notifications/schedule`
  - `POST /notifications/schedule/groups`
  - `GET /notifications/scheduled` `New`
- Parameters:
  - Schedule body `{ subject, body, recipients: string[] }`
  - Group schedule body `{ subject, body, group_ids: string[] }`
  - List query `page?`, `limit?`
- How to use:
  1. Current MVP sends immediately even though endpoint says schedule.
  2. `/notifications/scheduled` returns empty list shape for now.

### 12.4 Internal in-app notifications

- Endpoints:
  - `POST /notifications/internal` `New`
  - `GET /notifications/internal` `New`
  - `PATCH /notifications/internal/:id/read` `New`
- Parameters:
  - Create body `{ title, body, user_ids? }`
  - List query `page?`, `limit?`, `unread_only?=true|false`
  - Read path `id`
- How to use:
  1. FE creates internal notifications for all organization users or selected staff/admin users.
  2. FE polls `/notifications/internal` for in-app notification UI.
  3. FE marks a notification as read with `/notifications/internal/:id/read`.

## 13. Audit Workflow

### 13.1 Activity audit log

- Endpoint: `GET /audit/logs`
- Parameters: Query `{ page?, limit?, action?, entity_type?, entity_id?, user_id?, ip_address?, user_agent?, keyword?, from?, to? }`
- How to use:
  1. FE uses this for admin activity monitoring and audit filters.

### 13.2 Payment audit log

- Endpoint: `GET /audit/payment-logs/:payment_id`
- Parameters: Query `{ page?, limit?, event?, event_id?, keyword?, from?, to? }`
- How to use:
  1. FE uses this for payment timeline and troubleshooting UI.

## 14. Reporting Workflow

### 14.1 Dashboard reports

- Endpoints:
  - `GET /reports/summary`
  - `GET /reports/analytics`
  - `GET /reports/forms/performance` `New`
  - `GET /reports/groups/contributions` `New`
  - `GET /reports/export`
- Parameters:
  - Summary/analytics query `start_date?`, `end_date?`
  - Form performance query `start_date?`, `end_date?`
  - Group contributions query `form_id?`, `start_date?`, `end_date?`
  - Export query `{ type?=summary|analytics, format?=csv|pdf, start_date?, end_date? }`
- How to use:
  1. FE dashboard widgets can call summary and analytics.
  2. Advanced performance pages use form/group report endpoints.
  3. Export uses summary or analytics only today.

## 15. Health, Webhook, Billing, and Compliance Workflows

### 15.1 Health checks

- Endpoints:
  - `GET /health`
  - `GET /health/ready`
- How to use:
  - Primarily infra or ops usage. FE usually does not call these.

### 15.2 Paystack webhook

- Endpoint: `POST /webhooks/paystack`
- Parameters: Header `x-paystack-signature`, raw webhook body
- How to use:
  - Paystack-only route. FE should not call this.

### 15.3 Billing

- Endpoints:
  - `GET /billing/plans/:organizationId`
  - `GET /billing/usage/:organizationId`
  - `GET /billing/report/:organizationId`
  - `POST /billing/upgrade/:organizationId`
- Parameters:
  - Upgrade body `{ newPlanTier }`
- How to use:
  - FE billing screens can fetch plan, usage, and usage report, and submit plan upgrades.

### 15.4 Compliance

- Endpoints:
  - `POST /compliance/export`
  - `POST /compliance/delete`
  - `GET /compliance/export/:contactId/:organizationId`
  - `GET /compliance/retention-policy/:organizationId`
  - `POST /compliance/retention-policy/:organizationId`
  - `POST /compliance/purge/:organizationId`
  - `GET /compliance/audit-trail/:organizationId`
- Parameters:
  - Export/delete body `{ organizationId, contactId, requestedBy }`
  - Retention update body `policy object`
- How to use:
  - FE compliance tools can request export/delete, inspect policy, update retention policy, and review compliance trail.

## FE Integration Notes

- Use cookie-backed auth as primary behavior for browser sessions.
- Keep access token in memory only when FE needs to attach bearer token explicitly.
- For tenant deployments, backend can resolve tenant from request host, so FE should prefer correct tenant host over sending explicit org identifiers when possible.
- For public forms, FE should not assume every submission produces a payment redirect. Free forms now complete without Paystack.
- For notifications, FE no longer needs to worry about multi-recipient email exposure because backend now sends one recipient per outbound email.