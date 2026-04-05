# Payforms API Usage Workflows

This document describes the major Payforms API workflows, including each endpoint consumed and the process flow for typical frontend and backend scenarios.

## 1. Authentication Workflows

### 1.1 Admin / Staff Authentication

#### 1.1.1 Register Organization Admin

- Endpoint: `POST /auth/register`
- Body: `{ organization_name, email, password }`
- Flow:
  1. Admin enters school name, email, and password.
  2. Frontend posts to `/auth/register`.
  3. Backend creates organization, admin user, and returns session or auth response.
  4. Frontend stores JWT and transitions to dashboard.

#### 1.1.2 Login Admin / Staff

- Endpoint: `POST /auth/login`
- Body: `{ email, password }`
- Flow:
  1. Frontend displays login form for admin/staff.
  2. Submit credentials to `/auth/login`.
  3. Backend validates credentials, issues JWT.
  4. Frontend stores `Bearer <JWT>` and uses it for protected routes.

#### 1.1.3 Refresh Token

- Endpoint: `POST /auth/refresh`
- Body: `{ refresh_token }`
- Flow:
  1. Frontend detects expired access token or receives 401.
  2. Uses stored refresh token to call `/auth/refresh`.
  3. Backend issues a new access token.
  4. Frontend replaces token and retries the original request.

#### 1.1.4 Logout

- Endpoint: `POST /auth/logout`
- Auth: `Bearer <JWT>`
- Flow:
  1. Frontend sends logout request with auth header.
  2. Backend invalidates session or revokes token.
  3. Frontend clears stored auth state.

### 1.2 Invite and Accept Staff

#### 1.2.1 Invite Staff Member

- Endpoint: `POST /auth/invite`
- Auth: `Bearer <JWT>` (ADMIN only)
- Body: `{ first_name, last_name, email }`
- Flow:
  1. Admin enters invitee details.
  2. Frontend sends invite to `/auth/invite`.
  3. Backend creates a pending STAFF invitation and sends email.
  4. Frontend confirms invitation created.

#### 1.2.2 Accept Invitation

- Endpoint: `POST /auth/accept-invite`
- Body: `{ token, password }`
- Flow:
  1. Invitee clicks acceptance link from email.
  2. Frontend captures token and password.
  3. Submit to `/auth/accept-invite`.
  4. Backend creates the staff account, sets password, and returns auth response.

### 1.3 Forgot Password / Reset

#### 1.3.1 Request Password Reset

- Endpoint: `POST /auth/password-reset/request`
- Body: `{ email }`
- Flow:
  1. User enters email on forgot-password page.
  2. Frontend sends request to `/auth/password-reset/request`.
  3. Backend sends reset email with token.
  4. Frontend shows confirmation message.

#### 1.3.2 Confirm Password Reset

- Endpoint: `POST /auth/password-reset/confirm`
- Body: `{ token, password }`
- Flow:
  1. User follows email link.
  2. Frontend captures reset token and new password.
  3. Submit to `/auth/password-reset/confirm`.
  4. Backend updates password and returns success.

### 1.4 Organization Email Verification

#### 1.4.1 Request Verification

- Endpoint: `POST /auth/organization-email/request-verification`
- Auth: `Bearer <JWT>` (ADMIN only)
- Flow:
  1. Admin requests verification of organization email.
  2. Frontend calls endpoint.
  3. Backend sends verification email with token.

#### 1.4.2 Verify Organization Email

- Endpoint: `POST /auth/organization-email/verify`
- Body: `{ token }`
- Flow:
  1. User clicks verification link.
  2. Frontend submits token to `/auth/organization-email/verify`.
  3. Backend marks org email verified.

### 1.5 Profile and Self Service

#### 1.5.1 Get Current Profile

- Endpoint: `GET /auth/me`
- Auth: `Bearer <JWT>`
- Flow:
  1. Frontend requests authenticated user info.
  2. Backend returns current profile.

#### 1.5.2 Update Profile

- Endpoint: `PATCH /auth/profile`
- Auth: `Bearer <JWT>`
- Body: `{ first_name?, middle_name?, last_name?, title?, designation? }`
- Flow:
  1. User edits profile.
  2. Frontend sends patch.
  3. Backend updates profile and returns latest user data.

## 2. Organization Workflows

### 2.1 View Organization Details

- Endpoint: `GET /organization`
- Auth: `Bearer <JWT>`
- Flow:
  1. Frontend loads organization dashboard.
  2. Calls `/organization` with auth token.
  3. Backend returns org details.

### 2.2 Update Organization Settings

- Endpoint: `PATCH /organization`
- Auth: `Bearer <JWT>` (ADMIN only)
- Body:
  - `name?`
  - `email?`
  - `subdomain?`
  - `custom_domain?`
  - `require_contact_login?`
  - `notify_submission_confirmation?`
  - `notify_payment_confirmation?`
  - `notify_payment_failure?`
- Flow:
  1. Admin edits organization settings in UI.
  2. Frontend sends patch to `/organization`.
  3. Backend validates and persists changes.

### 2.3 Fetch Organization Settings Only

- Endpoint: `GET /organization/settings`
- Auth: `Bearer <JWT>`
- Flow:
  1. Frontend needs only organization-level display settings.
  2. Call `/organization/settings`.
  3. Backend returns concise setting payload.

### 2.4 Update Organization Settings Only

- Endpoint: `PATCH /organization/settings`
- Auth: `Bearer <JWT>` (ADMIN only)
- Flow:
  1. Admin updates settings that are specifically scoped to organization preferences.
  2. Frontend calls endpoint.
  3. Backend updates values without touching admin profile.

### 2.5 Update Paystack Keys

- Endpoint: `PATCH /organization/keys`
- Auth: `Bearer <JWT>` (ADMIN only)
- Body: `{ paystack_public_key?, paystack_secret_key? }`
- Flow:
  1. Admin enters payment gateway credentials.
  2. Frontend sends patch.
  3. Backend saves keys for payment verification and callbacks.

### 2.6 Upload Organization Logo

- Endpoint: `POST /organization/logo`
- Auth: `Bearer <JWT>` (ADMIN only)
- Body: `{ logo_url }`
- Flow:
  1. Admin uploads a logo to storage or provides a URL.
  2. Frontend posts the logo URL.
  3. Backend persists organization logo reference.

## 3. Form Workflows

### 3.1 Create a Form

- Endpoint: `POST /forms`
- Auth: `Bearer <JWT>`
- Body:
  - `title`
  - `category?`
  - `description?`
  - `note?`
  - `slug`
  - `payment_type`: `FIXED` or `VARIABLE`
  - `amount?`
  - `allow_partial`
- Flow:
  1. Admin configures a form in the dashboard.
  2. Frontend submits form metadata to `/forms`.
  3. Backend creates a form record and returns form info.

### 3.2 List Forms

- Endpoint: `GET /forms`
- Auth: `Bearer <JWT>`
- Query: `page?`, `limit?`
- Flow:
  1. Frontend lists forms on the admin dashboard.
  2. Call `/forms` with pagination.
  3. Backend returns paged result.

### 3.3 Get Form Details

- Endpoint: `GET /forms/:id`
- Auth: `Bearer <JWT>`
- Flow:
  1. Admin opens a specific form editor.
  2. Frontend fetches details from `/forms/:id`.
  3. Backend returns full form metadata.

### 3.4 Update Form

- Endpoint: `PATCH /forms/:id`
- Auth: `Bearer <JWT>`
- Body may include:
  - `title?`
  - `category?`
  - `description?`
  - `note?`
  - `is_active?`
  - `amount?`
  - `allow_partial?`
- Flow:
  1. Admin edits form settings.
  2. Frontend patches `/forms/:id`.
  3. Backend updates the form.

### 3.5 Delete Form

- Endpoint: `DELETE /forms/:id`
- Auth: `Bearer <JWT>`
- Flow:
  1. Admin deletes an unwanted form.
  2. Frontend calls delete endpoint.
  3. Backend removes the form record.

### 3.6 Manage Form Fields

#### Create Field
- Endpoint: `POST /forms/:id/fields`
- Auth: `Bearer <JWT>`
- Body:
  - `label`
  - `type`: `TEXT`, `EMAIL`, `SELECT`, `NUMBER`, `TEXTAREA`
  - `required`
  - `options?`
  - `order_index?`
  - `validation_rules?`
- Flow:
  1. Admin adds a field to a form.
  2. Frontend posts to `/forms/:id/fields`.
  3. Backend saves field configuration.

#### Update Field
- Endpoint: `PATCH /forms/fields/:fieldId`
- Auth: `Bearer <JWT>`
- Body may include:
  - `label?`
  - `type?`
  - `required?`
  - `options?`
  - `validation_rules?`
- Flow:
  1. Admin edits field properties.
  2. Frontend sends patch.
  3. Backend updates the field record.

#### Delete Field
- Endpoint: `DELETE /forms/fields/:fieldId`
- Auth: `Bearer <JWT>`
- Flow:
  1. Admin removes a field.
  2. Frontend calls delete.
  3. Backend deletes the field.

#### Reorder Fields
- Endpoint: `PATCH /forms/:id/fields/reorder`
- Auth: `Bearer <JWT>`
- Body: `{ fields: [{ id, order_index }] }`
- Flow:
  1. Admin changes field order.
  2. Frontend sends new ordering payload.
  3. Backend updates order indexes.

### 3.7 Form Targeting

#### Attach Groups or Contacts
- Endpoint: `POST /forms/:id/groups`
- Auth: `Bearer <JWT>`
- Body: `{ group_ids: string[] }`
- Flow:
  1. Admin targets a form to specific groups.
  2. Frontend submits group IDs.
  3. Backend attaches groups to form.

#### View Form Targets
- Endpoint: `GET /forms/:id/targets`
- Auth: `Bearer <JWT>`
- Flow:
  1. Frontend fetches current form targets.
  2. Backend returns assigned groups and contacts.

#### Add Targets
- Endpoint: `POST /forms/:id/targets`
- Auth: `Bearer <JWT>`
- Body:
  - `target_type`: `group` or `contact`
  - `target_ids: string[]`
- Flow:
  1. Admin adds form visibility targets.
  2. Backend creates target assignments.

#### Remove Targets
- Endpoint: `DELETE /forms/:id/targets/:targetId`
- Auth: `Bearer <JWT>`
- Flow:
  1. Admin removes one target.
  2. Backend deletes target assignment.

## 4. Group Workflows

### 4.1 Create Group

- Endpoint: `POST /groups`
- Auth: `Bearer <JWT>`
- Body:
  - `name`
  - `description?`
  - `note?`
  - `parent_group_id?`
- Flow:
  1. Admin creates a group or subgroup.
  2. Frontend sends create request.
  3. Backend returns new group details.

### 4.2 List Groups

- Endpoint: `GET /groups`
- Auth: `Bearer <JWT>`
- Query: `page?`, `limit?`
- Flow:
  1. Frontend lists groups with pagination.
  2. Backend returns group list.

### 4.3 Load Group Tree

- Endpoint: `GET /groups/tree`
- Auth: `Bearer <JWT>`
- Flow:
  1. Frontend needs nested group structure.
  2. Backend returns hierarchical groups for tree views.

### 4.4 Get Group Details

- Endpoint: `GET /groups/:id`
- Auth: `Bearer <JWT>`
- Flow:
  1. Frontend views group information.
  2. Backend returns group data.

### 4.5 Update Group

- Endpoint: `PATCH /groups/:id`
- Auth: `Bearer <JWT>`
- Body may include:
  - `name?`
  - `description?`
  - `note?`
  - `parent_group_id?`
- Flow:
  1. Admin edits group metadata.
  2. Frontend patches group.
  3. Backend persists changes.

### 4.6 Delete Group

- Endpoint: `DELETE /groups/:id`
- Auth: `Bearer <JWT>`
- Flow:
  1. Admin removes a group.
  2. Backend deletes the group record.

### 4.7 Add Contacts to Group

- Endpoint: `POST /groups/:id/contacts`
- Auth: `Bearer <JWT>`
- Body: `{ contact_ids: string[] }`
- Flow:
  1. Admin assigns contacts to a group.
  2. Frontend posts contact IDs.
  3. Backend associates contacts with group.

### 4.8 List Group Contacts

- Endpoint: `GET /groups/:id/contacts`
- Auth: `Bearer <JWT>`
- Query: `page?`, `limit?`
- Flow:
  1. Frontend lists members of a group.
  2. Backend returns paginated contacts.

## 5. Contact Workflows

### 5.1 Create Contact

- Endpoint: `POST /contacts`
- Auth: `Bearer <JWT>`
- Body:
  - `first_name?`
  - `middle_name?`
  - `last_name?`
  - `email`
  - `phone?`
  - `gender?`
  - `student_id?`
  - `external_id?`
  - `guardian_name?`
  - `guardian_email?`
  - `guardian_phone?`
  - `require_login?` (boolean, defaults to `true`)
  - `must_reset_password?` (boolean override)
- Flow:
  1. Admin adds a new contact.
  2. Frontend posts contact data.
  3. Backend creates the contact and may send password setup email if required.

### 5.2 List Contacts

- Endpoint: `GET /contacts`
- Auth: `Bearer <JWT>`
- Query: `group_id?`, `page?`, `limit?`
- Flow:
  1. Frontend loads contacts list.
  2. Optionally filter by `group_id`.
  3. Backend returns results.

### 5.3 Export Contacts

- Endpoint: `GET /contacts/export`
- Auth: `Bearer <JWT>`
- Query: `group_id?`
- Flow:
  1. Admin requests CSV export.
  2. Frontend triggers download.
  3. Backend returns CSV payload.

### 5.4 Get Contact Details

- Endpoint: `GET /contacts/:id`
- Auth: `Bearer <JWT>`
- Flow:
  1. Frontend fetches contact details for edit/view.
  2. Backend returns contact data.

### 5.5 Get Contact Details with Hierarchy

- Endpoint: `GET /contacts/:id/details`
- Auth: `Bearer <JWT>`
- Flow:
  1. Frontend needs contact plus resolved group paths.
  2. Backend returns contact and `group_hierarchy` for breadcrumb-style display.

### 5.6 Update Contact

- Endpoint: `PATCH /contacts/:id`
- Auth: `Bearer <JWT>`
- Body may include:
  - `name?`
  - `email?`
  - `phone?`
  - `is_active?`
- Flow:
  1. Admin edits contact data.
  2. Frontend sends patch.
  3. Backend updates contact record.

### 5.7 Delete Contact

- Endpoint: `DELETE /contacts/:id`
- Auth: `Bearer <JWT>`
- Flow:
  1. Admin deletes a contact.
  2. Backend removes the contact.

### 5.8 Assign Contact to Groups

- Endpoint: `POST /contacts/:id/groups`
- Auth: `Bearer <JWT>`
- Body: `{ group_ids: string[] }`
- Flow:
  1. Admin assigns existing groups to a contact.
  2. Backend updates membership.

## 6. Contact Import Workflows

### 6.1 Validate Import Payload

- Endpoint: `POST /contacts/imports/validate`
- Auth: `Bearer <JWT>`
- Body: same as `/contacts/import`
- Flow:
  1. Frontend uploads or constructs import payload.
  2. Send validation request to `/contacts/imports/validate`.
  3. Backend examines rows, group mappings, and required fields.
  4. Frontend shows errors or confirmation before commit.

### 6.2 Commit Validated Import

- Endpoint: `POST /contacts/imports/:id/commit`
- Auth: `Bearer <JWT>`
- Flow:
  1. After validation succeeds, frontend calls `/contacts/imports/:id/commit`.
  2. Backend creates or updates contacts, resolves groups, and sends password setup if needed.
  3. Frontend displays import summary.

### 6.3 Direct Import

- Endpoint: `POST /contacts/import`
- Auth: `Bearer <JWT>`
- Body:
  - `contacts: [{ name, email, phone?, external_id?, group_ids?, groups?, group_paths?, require_login?, is_active?, must_reset_password? }]`
- Flow:
  1. Frontend uses direct JSON import for smaller batches.
  2. Backend processes contacts immediately.
  3. Returns import result or errors.

### 6.4 Review Import History

- Endpoint: `GET /contacts/imports`
- Auth: `Bearer <JWT>`
- Query: `page?`, `limit?`
- Flow:
  1. Frontend shows import records.
  2. Backend returns paged import history.

### 6.5 Get Import Details

- Endpoint: `GET /contacts/imports/:id`
- Auth: `Bearer <JWT>`
- Flow:
  1. Frontend inspects a specific import.
  2. Backend returns import metadata and status.

## 7. Contact Auth / Student Login Workflows

### 7.1 Contact Login

- Endpoint: `POST /contact-auth/login`
- Body:
  - `email`
  - `password`
  - `organization_id?`
  - `organization_subdomain?`
  - `organization_domain?`
- Flow:
  1. Student/contact opens login page.
  2. Frontend submits email/password.
  3. If tenant routing is enabled, backend resolves org by request host or optional org fields.
  4. Backend authenticates contact and returns contact JWT.

### 7.2 Set Password

- Endpoint: `POST /contact-auth/set-password`
- Body: `{ token, password }`
- Flow:
  1. Contact receives password setup link email.
  2. Frontend posts token and password.
  3. Backend sets contact password and activates login.

### 7.3 Request Password Reset

- Endpoint: `POST /contact-auth/reset/request`
- Body:
  - `email`
  - `organization_id?`
  - `organization_subdomain?`
  - `organization_domain?`
- Flow:
  1. Contact requests reset.
  2. Frontend sends email plus optional organization context.
  3. Backend issues reset token and email.

### 7.4 Confirm Password Reset

- Endpoint: `POST /contact-auth/reset/confirm`
- Body: `{ token, password }`
- Flow:
  1. Contact submits reset token with new password.
  2. Backend updates the contact password.

### 7.5 Alias Password Reset Endpoints

- Endpoints:
  - `POST /contact-auth/password-reset/request`
  - `POST /contact-auth/password-reset/confirm`
- Flow: Same as `/reset/request` and `/reset/confirm`, but preserved for compatibility.

### 7.6 Get Contact Profile

- Endpoint: `GET /contact-auth/me`
- Auth: contact JWT
- Flow:
  1. Authenticated contact loads their profile.
  2. Backend returns contact-specific data.

### 7.7 Contact Receipt Access

- Endpoint: `GET /contact-auth/payments/:id/receipt`
- Auth: contact JWT
- Flow:
  1. Authenticated contact requests a receipt for their transaction.
  2. Backend returns downloadable PDF.

### 7.8 Receipt by Reference

- Endpoint: `GET /contact-auth/payments/reference/:reference/receipt`
- Auth: contact JWT
- Flow:
  1. Contact requests receipt by payment reference.
  2. Backend validates ownership and returns PDF.

## 8. Payment Workflows

### 8.1 List Payments

- Endpoint: `GET /payments`
- Auth: `Bearer <JWT>`
- Query: `page?`, `limit?`, `format?` (`csv`)
- Flow:
  1. Frontend shows payment history.
  2. Backend returns paged payment list.

### 8.2 Get Payment Details

- Endpoint: `GET /payments/:id`
- Auth: `Bearer <JWT>`
- Flow:
  1. Admin views a payment.
  2. Backend returns payment record.

### 8.3 Verify Payment Reference

- Endpoint: `GET /payments/verify/:reference`
- Auth: `Bearer <JWT>`
- Flow:
  1. Frontend or server calls this after Paystack redirect or webhook.
  2. Backend verifies with Paystack, updates status, logs event.

### 8.4 Create Payment Record

- Endpoint: `POST /payments`
- Auth: `Bearer <JWT>`
- Body:
  - `submission_id`
  - `amount`
  - `reference?`
- Flow:
  1. Backend or admin records a payment attempt.
  2. Frontend may call this as part of submission or manual payment creation.

### 8.5 Update Payment Status

- Endpoint: `POST /payments/:id/status`
- Auth: `Bearer <JWT>`
- Body:
  - `status`: `PENDING | PAID | PARTIAL | FAILED`
  - `paid_at?`
- Flow:
  1. Backend updates payment lifecycle state.
  2. Frontend may use this for manual override or correction.

## 9. Transaction Workflows

### 9.1 List Transactions

- Endpoint: `GET /transactions`
- Auth: `Bearer <JWT>`
- Query: `status?`, `reference?`, `form_id?`, `contact_id?`, `start_date?`, `end_date?`, `page?`, `limit?`, `format?` (`csv`)
- Flow:
  1. Admin queries transaction history.
  2. Backend returns filtered transaction list.

### 9.2 Get Transaction Detail

- Endpoint: `GET /transactions/:id`
- Auth: `Bearer <JWT>`
- Flow:
  1. Frontend opens transaction detail.
  2. Backend returns the transaction.

### 9.3 Transaction History

- Endpoint: `GET /transactions/:id/history`
- Auth: `Bearer <JWT>`
- Query: `page?`, `limit?`
- Flow:
  1. Frontend shows event history for a transaction.
  2. Backend returns audit and status events.

## 10. Public Submission Workflows

### 10.1 Fetch Public Form

- Endpoint: `GET /public/forms/:slug`
- Header: `Authorization: Bearer <contact token>` optional for targeted forms
- Flow:
  1. Public or targeted user requests a form by slug.
  2. Frontend or embed widget loads the form structure.
  3. Backend returns form fields and configuration.

### 10.2 Fetch Widget Config

- Endpoint: `GET /public/forms/:slug/widget-config`
- Header: `Authorization: Bearer <contact token>` optional for targeted forms
- Flow:
  1. Frontend or embed script requests widget metadata.
  2. Backend returns endpoints, embed code, and event names.

### 10.3 Load Embed Script

- Endpoint: `GET /public/forms/:slug/embed.js`
- Flow:
  1. Host page includes the embed script.
  2. Script bootstraps widget with optional attributes.
  3. Backend returns JavaScript widget shell.

### 10.4 Load Widget HTML

- Endpoint: `GET /public/forms/:slug/widget`
- Query:
  - `callback_url?`
  - `contact_token?`
  - `contact_email?`
  - `contact_name?`
  - `auto_redirect?`
- Flow:
  1. Browser loads iframe widget HTML.
  2. Backend returns the iframe content.

### 10.5 Submit Public Form

- Endpoint: `POST /public/forms/:slug/submit`
- Query: `callback_url?`
- Header: `Authorization: Bearer <contact token>` optional for targeted forms
- Body:
  - `data: { ...field values }`
  - `contact_email?`
  - `contact_name?`
- Flow:
  1. User submits the public form.
  2. Frontend posts submission payload.
  3. Backend records submission, validates fields, and returns success.
  4. If payment is required, redirect or callback occurs via Paystack flow.

### 10.6 Payment Callback

- Endpoint: `GET /public/payments/callback`
- Query: `reference` or `trxref`
- Flow:
  1. Paystack redirects back after payment.
  2. Frontend or browser hits callback endpoint.
  3. Backend verifies payment and finalizes transaction status.

## 11. Webhook Workflow

### 11.1 Paystack Webhook

- Endpoint: `POST /webhooks/paystack`
- Header: `x-paystack-signature`
- Flow:
  1. Paystack sends payment event payload.
  2. Backend verifies signature.
  3. Backend updates the payment record and logs event.

## 12. Notification Workflows

### 12.1 Send Reminder to Contacts

- Endpoint: `POST /notifications/reminder`
- Auth: `Bearer <JWT>`
- Body:
  - `contact_ids: string[]`
  - `message?`
- Flow:
  1. Admin selects contacts to notify.
  2. Frontend sends reminder payload.
  3. Backend sends notification to selected contacts.

### 12.2 Send Reminder to Groups

- Endpoint: `POST /notifications/reminder/groups`
- Auth: `Bearer <JWT>`
- Body:
  - `group_ids: string[]`
  - `message?`
- Flow:
  1. Admin selects groups.
  2. Backend delivers reminders to group members.

### 12.3 Schedule Notification to Contacts

- Endpoint: `POST /notifications/schedule`
- Auth: `Bearer <JWT>`
- Body:
  - `subject`
  - `body`
  - `recipients: string[]`
- Flow:
  1. Admin schedules message for specific contacts.
  2. Backend stores schedule and dispatches at the configured time.

### 12.4 Schedule Notification to Groups

- Endpoint: `POST /notifications/schedule/groups`
- Auth: `Bearer <JWT>`
- Body:
  - `group_ids: string[]`
  - `subject`
  - `body`
- Flow:
  1. Admin schedules message for groups.
  2. Backend sends to group members when triggered.

## 13. Audit Workflows

### 13.1 Fetch Audit Logs

- Endpoint: `GET /audit/logs`
- Auth: `Bearer <JWT>`
- Query: `page?`, `limit?`, `action?`, `entity_type?`, `entity_id?`, `user_id?`, `ip_address?`, `user_agent?`, `keyword?`, `from?`, `to?`
- Flow:
  1. Admin requests activity audit trail.
  2. Backend returns filtered logs.

### 13.2 Fetch Payment Audit Logs

- Endpoint: `GET /audit/payment-logs/:payment_id`
- Auth: `Bearer <JWT>`
- Query: `page?`, `limit?`, `event?`, `event_id?`, `keyword?`, `from?`, `to?`
- Flow:
  1. Admin inspects a payment lifecycle.
  2. Backend returns related payment audit events.

## 14. Report Workflows

### 14.1 Fetch Summary Report

- Endpoint: `GET /reports/summary`
- Auth: `Bearer <JWT>`
- Query: `start_date?`, `end_date?`
- Flow:
  1. Frontend requests high-level summary.
  2. Backend returns aggregated metrics.

### 14.2 Fetch Analytics Report

- Endpoint: `GET /reports/analytics`
- Auth: `Bearer <JWT>`
- Query: `start_date?`, `end_date?`
- Flow:
  1. Frontend requests analytics data.
  2. Backend returns metric series and totals.

### 14.3 Fetch Form Performance Report

- Endpoint: `GET /reports/forms/performance`
- Auth: `Bearer <JWT>`
- Query: `start_date?`, `end_date?`
- Flow:
  1. Frontend requests per-form metrics.
  2. Backend returns submission counts, payments, and conversion rates.

### 14.4 Export Reports

- Endpoint: `GET /reports/export`
- Auth: `Bearer <JWT>`
- Query:
  - `type?` = `summary | analytics`
  - `format?` = `csv | pdf`
  - `start_date?`
  - `end_date?`
- Flow:
  1. Admin exports report files.
  2. Backend generates CSV or PDF.

## 15. Health Checks

### 15.1 Basic Health

- Endpoint: `GET /health`
- Flow:
  1. Monitoring or load balancer checks app health.
  2. Backend returns health status.

### 15.2 Readiness Probe

- Endpoint: `GET /health/ready`
- Flow:
  1. Infrastructure checks readiness before routing traffic.
  2. Backend returns ready state.

## 16. Example End-to-End Scenarios

### 16.1 Admin Setup and Publish a Targeted Form

1. `POST /auth/register` to create org admin.
2. `POST /auth/login` to authenticate admin and obtain JWT.
3. `POST /forms` to create a new form.
4. `POST /forms/:id/fields` to add form fields.
5. `POST /groups` to create recipient groups.
6. `POST /forms/:id/groups` to assign groups.
7. `POST /contacts/imports/validate` to validate bulk contact import.
8. `POST /contacts/imports/:id/commit` to create contacts.
9. `GET /public/forms/:slug` to verify public form availability.

### 16.2 Contact Login via Subdomain

1. Contact opens `https://om.payforms.vercels.com`.
2. Frontend displays login page for contact.
3. Contact submits `email` and `password` to `POST /contact-auth/login`.
4. Backend resolves organization from request host or optional org fields.
5. Backend returns contact JWT.
6. Contact uses `GET /contact-auth/me` to load profile.

### 16.3 Public Form Submission with Payment

1. User loads widget via `GET /public/forms/:slug/widget-config` or `/embed.js`.
2. Browser renders form to the public.
3. User submits data to `POST /public/forms/:slug/submit`.
4. Backend validates submission and creates a pending transaction if payment is required.
5. Paystack redirects to `GET /public/payments/callback` after payment.
6. Backend verifies payment with `GET /payments/verify/:reference` and updates status.

### 16.4 Retrieve Payment History and Receipts

1. Admin calls `GET /payments` for payment list.
2. Admin opens a payment item with `GET /payments/:id`.
3. Contact requests receipt with `GET /contact-auth/payments/:id/receipt`.
4. Contact may also use `GET /contact-auth/payments/reference/:reference/receipt`.

## 17. Practical Frontend Integration Notes

- All protected admin routes require `Authorization: Bearer <JWT>`.
- Contact-auth routes require a contact JWT for authenticated contact operations.
- For subdomain-based tenant resolution, the backend uses the request `Host` header and/or optional `organization_subdomain` / `organization_domain` / `organization_id` fields.
- `GET /public/forms/:slug` and submit endpoints support optional contact token authorization for targeted forms.
- Use `format=csv` on list endpoints where available to download CSV exports.
- Always validate import data first via `/contacts/imports/validate` before calling commit.

## 18. API Usage Patterns

### 18.1 Build a Dashboard

- Authenticate admin via `/auth/login`.
- Fetch org settings using `/organization` and `/organization/settings`.
- Fetch forms and groups via `/forms` and `/groups/tree`.
- Display contacts via `/contacts` and contact hierarchies via `/contacts/:id/details`.
- Use `/reports/*` for analytics panels.

### 18.2 Manage Contacts and Groups

- Create contacts via `/contacts`.
- Import bulk contacts using `/contacts/imports/validate` + `/contacts/imports/:id/commit`.
- Assign groups through `/contacts/:id/groups` and `/groups/:id/contacts`.
- Export contacts through `/contacts/export`.

### 18.3 Handle Payments

- Create payment records with `/payments`.
- Update payment status via `/payments/:id/status`.
- Verify payment success using `/payments/verify/:reference`.
- Stream transaction history via `/transactions` and `/transactions/:id/history`.

### 18.4 Notifications and Audit

- Send reminders with `/notifications/reminder` or `/notifications/reminder/groups`.
- Schedule campaigns with `/notifications/schedule` or `/notifications/schedule/groups`.
- Inspect actions using `/audit/logs` and `/audit/payment-logs/:payment_id`.

---

This workflow document is intended to guide frontend and backend integration by describing each major scenario, the API endpoints involved, and the sequential process flow required for successful usage.