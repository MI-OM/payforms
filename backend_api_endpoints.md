# Payforms Backend API Reference

## Auth Endpoints

- `POST /auth/register`
  - Body: `{ organization_name, email, password, title?, designation? }`
- `POST /auth/login`
  - Body: `{ email, password }`
- `POST /auth/invite`
  - Auth: `Bearer <JWT>` (ADMIN only)
  - Body: `{ email, role?, title?, designation? }`
- `POST /auth/accept-invite`
  - Body: `{ token, password, title?, designation? }`
- `POST /auth/refresh`
  - Body: `{ refresh_token }`
- `POST /auth/password-reset/request`
  - Body: `{ email }`
- `POST /auth/password-reset/confirm`
  - Body: `{ token, password }`
- `POST /auth/organization-email/verify`
  - Body: `{ token }`
- `POST /auth/organization-email/request-verification`
  - Auth: `Bearer <JWT>` (ADMIN only)
- `GET /auth/organization-email/status`
  - Auth: `Bearer <JWT>`
- `POST /auth/logout`
  - Auth: `Bearer <JWT>`
- `GET /auth/me`
  - Auth: `Bearer <JWT>`
  - Returns user profile including `title` and `designation` when set

## Organization Endpoints

- `GET /organization`
  - Auth: `Bearer <JWT>` (ADMIN or STAFF)
- `PATCH /organization`
  - Auth: `Bearer <JWT>` (ADMIN)
  - Body values:
    - `name?`
    - `email?`
    - `require_contact_login?`
    - `notify_submission_confirmation?`
    - `notify_payment_confirmation?`
    - `notify_payment_failure?`
- `GET /organization/settings`
  - Auth: `Bearer <JWT>` (ADMIN or STAFF)
- `PATCH /organization/settings`
  - Auth: `Bearer <JWT>` (ADMIN)
- `PATCH /organization/keys`
  - Auth: `Bearer <JWT>` (ADMIN)
  - Body values:
    - `paystack_public_key?`
    - `paystack_secret_key?`
- `POST /organization/logo`
  - Auth: `Bearer <JWT>` (ADMIN)
  - Body: `{ logo_url }`

## Form Endpoints

- `POST /forms`
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
- `GET /forms`
  - Auth: `Bearer <JWT>`
  - Query: `page?`, `limit?`
- `GET /forms/:id`
  - Auth: `Bearer <JWT>`
- `PATCH /forms/:id`
  - Auth: `Bearer <JWT>`
  - Body values:
    - `title?`
    - `category?`
    - `description?`
    - `note?`
    - `is_active?`
    - `amount?`
    - `allow_partial?`
- `DELETE /forms/:id`
  - Auth: `Bearer <JWT>`
- `POST /forms/:id/fields`
  - Auth: `Bearer <JWT>`
  - Body:
    - `label`
    - `type`: `TEXT`, `EMAIL`, `SELECT`, `NUMBER`, `TEXTAREA`
    - `required`
    - `options?`
    - `order_index?`
    - `validation_rules?`
- `PATCH /forms/fields/:fieldId`
  - Auth: `Bearer <JWT>`
  - Body may include:
    - `label?`
    - `type?`
    - `required?`
    - `options?`
    - `validation_rules?`
- `DELETE /forms/fields/:fieldId`
  - Auth: `Bearer <JWT>`
- `PATCH /forms/:id/fields/reorder`
  - Auth: `Bearer <JWT>`
  - Body: `{ fields: [{ id, order_index }] }`
- `POST /forms/:id/groups`
  - Auth: `Bearer <JWT>`
  - Body: `{ group_ids: string[] }`
- `GET /forms/:id/groups`
  - Auth: `Bearer <JWT>`
- `GET /forms/:id/targets`
  - Auth: `Bearer <JWT>`
- `POST /forms/:id/targets`
  - Auth: `Bearer <JWT>`
  - Body:
    - `target_type`: `group` or `contact`
    - `target_ids: string[]`
- `DELETE /forms/:id/targets/:targetId`
  - Auth: `Bearer <JWT>`

## Group Endpoints

- `POST /groups`
  - Auth: `Bearer <JWT>`
  - Body:
    - `name`
    - `description?`
    - `note?`
    - `parent_group_id?`
- `GET /groups`
  - Auth: `Bearer <JWT>`
  - Query: `page?`, `limit?`
- `GET /groups/tree`
  - Auth: `Bearer <JWT>`
- `GET /groups/:id`
  - Auth: `Bearer <JWT>`
- `PATCH /groups/:id`
  - Auth: `Bearer <JWT>`
  - Body may include:
    - `name?`
    - `description?`
    - `note?`
    - `parent_group_id?`
- `DELETE /groups/:id`
  - Auth: `Bearer <JWT>`
- `POST /groups/:id/contacts`
  - Auth: `Bearer <JWT>`
  - Body: `{ contact_ids: string[] }`
- `GET /groups/:id/contacts`
  - Auth: `Bearer <JWT>`
  - Query: `page?`, `limit?`

## Contact Endpoints

- `POST /contacts`
  - Auth: `Bearer <JWT>`
  - Body:
    - `name`
    - `email`
    - `phone?`
    - `external_id?`
- `GET /contacts`
  - Auth: `Bearer <JWT>`
  - Query: `group_id?`, `page?`, `limit?`
- `GET /contacts/export`
  - Auth: `Bearer <JWT>`
  - Query: `group_id?`
- `GET /contacts/:id`
  - Auth: `Bearer <JWT>`

- `GET /contacts/:id/details`
  - Auth: `Bearer <JWT>`
  - Purpose: return contact plus fully resolved group hierarchy path(s) (including subgroup nesting), for UI context display and breadcrumb building
  - Response example:
    ```json
    {
      "id": "contact-uuid",
      "first_name": "John",
      "middle_name": "A.",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "gender": "male",
      "student_id": "S12345",
      "guardian_name": "Jane Doe",
      "require_login": false,
      "is_active": true,
      "groups": [
        {
          "id": "group-uuid",
          "name": "Engineering",
          "parent_group_id": "parent-group-uuid"
        }
      ],
      "group_hierarchy": [
        "Faculty > Engineering > 400 Level",
        "Alumni > 2026"
      ],
      "created_at": "2026-04-02T13:45:00.000Z"
    }
    ```
  - Notes:
    - `groups` is direct contact group membership.
    - `group_hierarchy` contains joined text paths from leaf group up through parents (supports subgroup nesting).
    - Useful for FE sections: contact card header, permission tests, breadcrumbs in contact merge UI.

- `PATCH /contacts/:id`
  - Auth: `Bearer <JWT>`
  - Body may include:
    - `name?`
    - `email?`
    - `phone?`
    - `is_active?`
- `DELETE /contacts/:id`
  - Auth: `Bearer <JWT>`
- `POST /contacts/import`
  - Auth: `Bearer <JWT>`
  - Body:
    - `contacts: [{ ... }]`
    - Per contact row fields:
      - `name`
      - `email`
      - `phone?`
      - `external_id?`
      - `group_ids?` (existing group UUIDs)
      - `groups?` (group names)
      - `group_paths?` (nested paths e.g. `Faculty > Engineering > 400 Level`)
      - `require_login?` (boolean)
      - `is_active?` (boolean)
      - `must_reset_password?` (boolean override)
- `POST /contacts/imports/validate`
  - Auth: `Bearer <JWT>`
  - Body: same shape as `/contacts/import`
- `POST /contacts/imports/:id/commit`
  - Auth: `Bearer <JWT>`
- `GET /contacts/imports`
  - Auth: `Bearer <JWT>`
  - Query: `page?`, `limit?`
- `GET /contacts/imports/:id`
  - Auth: `Bearer <JWT>`
- `GET /contacts/:id/transactions`
  - Auth: `Bearer <JWT>`
  - Query: `page?`, `limit?`, `format?` = `csv`
- `POST /contacts/:id/groups`
  - Auth: `Bearer <JWT>`
  - Body: `{ group_ids: string[] }`

## Contact Auth Endpoints

- `POST /contact-auth/login`
  - Body: `{ email, password }`
- `POST /contact-auth/set-password`
  - Body: `{ email, password }`
- `POST /contact-auth/reset/request`
  - Body: `{ email }`
- `POST /contact-auth/reset/confirm`
  - Body: `{ token, password }`
- `POST /contact-auth/password-reset/request`
  - Body: `{ email }`
- `POST /contact-auth/password-reset/confirm`
  - Body: `{ token, password }`
- `GET /contact-auth/me`
  - Auth: contact JWT

## Payment Endpoints

- `GET /payments`
  - Auth: `Bearer <JWT>`
  - Query: `page?`, `limit?`, `format?` (`csv`)
- `GET /payments/:id`
  - Auth: `Bearer <JWT>`
- `GET /payments/verify/:reference`
  - Auth: `Bearer <JWT>`
- `POST /payments`
  - Auth: `Bearer <JWT>`
  - Body:
    - `submission_id`
    - `amount`
    - `reference?`
- `POST /payments/:id/status`
  - Auth: `Bearer <JWT>`
  - Body:
    - `status`: `PENDING | PAID | PARTIAL | FAILED`
    - `paid_at?`

## Transaction Endpoints

- `GET /transactions`
  - Auth: `Bearer <JWT>`
  - Query: `status?`, `reference?`, `form_id?`, `contact_id?`, `start_date?`, `end_date?`, `page?`, `limit?`, `format?` (`csv`)
- `GET /transactions/:id`
  - Auth: `Bearer <JWT>`
- `GET /transactions/:id/history`
  - Auth: `Bearer <JWT>`
  - Query: `page?`, `limit?`

## Webhook Endpoints

- `POST /webhooks/paystack`
  - Header: `x-paystack-signature`
  - Body: raw Paystack webhook JSON

## Public Submission Endpoints

- `GET /public/forms/:slug`
  - Header: `Authorization: Bearer <contact token>` optional for targeted forms
- `GET /public/forms/:slug/widget-config`
  - Header: `Authorization: Bearer <contact token>` optional for targeted forms
  - Returns:
    - `form`
    - `endpoints`: `form`, `submit`, `widget`, `embed_script`
    - `embed_code`
    - `events`: `ready | submitted | payment_initialized | error | resize`
- `GET /public/forms/:slug/embed.js`
  - Returns embeddable widget bootstrap JavaScript (`Content-Type: application/javascript`)
  - Supported script attributes:
    - `data-callback-url?`
    - `data-api-base?`
    - `data-contact-token?`
    - `data-contact-email?`
    - `data-contact-name?`
    - `data-width?`
    - `data-height?`
    - `data-min-height?`
    - `data-auto-redirect?` (`true` or `false`)
    - `data-container?` (CSS selector for host mount point)
- `GET /public/forms/:slug/widget`
  - Returns iframe-ready HTML widget shell (`Content-Type: text/html`)
  - Query:
    - `callback_url?`
    - `contact_token?`
    - `contact_email?`
    - `contact_name?`
    - `auto_redirect?` (`true` by default, set `false` to stop auto-redirect)
- `POST /public/forms/:slug/submit`
  - Query: `callback_url?`
  - Header: `Authorization: Bearer <contact token>` optional for targeted forms
  - Body:
    - `data: { ...field values }`
    - `contact_email?`
    - `contact_name?`

## Notification Endpoints

- `POST /notifications/reminder`
  - Auth: `Bearer <JWT>`
  - Body:
    - `contact_ids: string[]`
    - `message?`
- `POST /notifications/schedule`
  - Auth: `Bearer <JWT>`
  - Body:
    - `subject`
    - `body`
    - `recipients: string[]`

## Audit Endpoints

- `GET /audit/logs`
  - Auth: `Bearer <JWT>`
  - Query: `page?`, `limit?`, `action?`, `entity_type?`, `entity_id?`, `user_id?`, `ip_address?`, `user_agent?`, `keyword?`, `from?`, `to?`
- `GET /audit/payment-logs/:payment_id`
  - Auth: `Bearer <JWT>`
  - Query: `page?`, `limit?`, `event?`, `event_id?`, `keyword?`, `from?`, `to?`

## Report Endpoints

- `GET /reports/summary`
  - Auth: `Bearer <JWT>`
  - Query: `start_date?`, `end_date?`
- `GET /reports/analytics`
  - Auth: `Bearer <JWT>`
  - Query: `start_date?`, `end_date?`
- `GET /reports/export`
  - Auth: `Bearer <JWT>`
  - Query:
    - `type?` = `summary | analytics`
    - `format?` = `csv | pdf`
    - `start_date?`
    - `end_date?`

## Health Endpoints

- `GET /health`
- `GET /health/ready`

## Testing Parameters

- Header: `Authorization: Bearer <JWT>` for protected routes
- Path params: `id`, `slug`, `reference`, `payment_id`, `targetId`, `fieldId`
- Query params:
  - `page`, `limit`
  - `group_id`
  - `status`, `reference`, `form_id`, `contact_id`, `start_date`, `end_date`
  - `format`, `type`, `callback_url`
- Body fields vary by endpoint and are documented above

## Example Test Scenario

1. `POST /auth/login`
   - Body: `{ "email": "admin@example.com", "password": "Password123" }`
   - Save returned JWT for authenticated requests.
2. `POST /forms`
   - Auth: `Bearer <JWT>`
   - Body:
     `{ "title": "Donation", "slug": "donate", "payment_type": "FIXED", "amount": 5000, "allow_partial": false }`
3. `POST /forms/:id/fields`
   - Auth: `Bearer <JWT>`
   - Body:
     `{ "label": "email", "type": "EMAIL", "required": true }`
4. `POST /public/forms/donate/submit`
   - Query: `callback_url=http://example.com/callback`
   - Body:
     `{ "data": { "email": "payer@test.com" }, "contact_email": "payer@test.com", "contact_name": "Payer Test" }`
5. Assert response includes:
   - `submission`
   - `payment`
   - `authorization`
6. Optional follow-up checks:
   - `GET /payments/verify/:reference`
   - `GET /transactions`
   - `GET /audit/logs?entity_type=submission`
