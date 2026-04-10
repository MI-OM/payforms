# Backend Backlog

## Completed Tasks
- ✅ Contact password reset functionality
- ✅ Notification triggers (submission confirmations, payment confirmations, failed payment reminders)
- ✅ Payment workflow hardening (webhook idempotency, Paystack status mapping)
- ✅ Audit and usage tracking (filtering and search capabilities)
- ✅ Public form flow improvements (field validations)
- ✅ Security enhancements (role-based authorization for organization endpoints)
- ✅ Infrastructure ops (health check endpoints)
- ✅ Organization Notification Preferences: Implement settings for organizations to customize notification triggers and preferences.
- ✅ JWT Refresh Tokens: Implement refresh token functionality for better session management.
- ✅ Migrations Workflow: Set up proper database migration scripts and workflow for production deployments.
- ✅ Environment Variables Documentation: Document all required environment variables in README.md.
- ✅ Transaction API: Add `/transactions` endpoints with filters, transaction details, and gateway response history.
- ✅ Contact Export & History: Add contact export, contact transaction history, and group-based contact filtering.

## Remaining Tasks
1. **Form Targeting System**: Implement form targets for groups, subgroups, and individual contacts, with eligibility checks for login-protected forms.
2. **Hierarchical Groups**: Add `parent_group_id` support, group/subgroup tree endpoints, and delete-only-if-empty rules.
3. **Staff Invitation Flow**: Build user invite and accept-invite endpoints for admin/staff onboarding.
4. **Import Module**: Add import validation and commit endpoints, import logs, and status tracking.
5. **Reporting & Analytics**: Implement summary, advanced analytics, and export endpoints (CSV/PDF).
6. ✅ Audit Enhancements: Extend activity logs with IP/user-agent metadata and advanced audit filtering.
7. **Comprehensive Testing Suite**: Implement unit tests, integration tests, and end-to-end tests for the entire backend.
8. **Stale Pending Payment Reconciliation**: Add a scheduled cleanup/reconciliation job to mark long-running `PENDING` Paystack payments as `FAILED` or `ABANDONED` when no webhook or redirect verification arrives.
9. **Inline Paystack Checkout Flow**: Replace the current full-page redirect checkout with Paystack inline/popup flow so failed, cancelled, or closed transactions can return control to the app immediately.
10. **Two-Factor Authentication for Staff**: Add TOTP-based 2FA setup, verification, recovery codes, and login challenge endpoints for admin/staff accounts.
11. **Payment Method Field on Payments/Transactions**: Add a `payment_method` field with values such as `ONLINE`, `CASH`, `BANK_TRANSFER`, `POS`, and `CHEQUE`, expose it in payment/transaction list and detail responses, and make it filterable in exports and reporting. This is the safest first step because it is additive and does not change current checkout behavior.
12. **Offline Cash Payment Flow**: Allow payers or admins to select `CASH` as a payment method, create the payment as pending without Paystack redirect, and keep the current online flow unchanged for `ONLINE` payments. Phase this behind a flag or form-level setting so existing organizations are unaffected.
13. **Admin Confirmation Workflow for Offline Payments**: Extend manual payment confirmation so admins can confirm or reject `CASH` and other offline payments with metadata such as `confirmed_by`, `confirmed_at`, `confirmation_note`, and optional `external_reference` (teller number/receipt book number). Keep this as a separate workflow from Paystack verification to avoid breaking current status updates.
14. **Admin Printable Transaction Receipts**: Add admin-side receipt download/reprint endpoints for every transaction, including manual and offline payments, and include payment method plus confirmation metadata on the receipt. Reuse the existing receipt PDF generation path where possible instead of creating a second receipt engine.
15. **School Payment Operations Enhancements**: Add school-focused payment operations features in phases: pending-offline-payment queue, reporting by payment method, class/arm/session payment summaries, arrears/balance tracking, and bulk offline payment posting. Prioritize read/reporting features before workflow-heavy changes to minimize codebase risk.

## Secondary School Rollout Notes
- **Phase 1 - Additive, low-risk**: `payment_method` field, response payload exposure, transaction filters, CSV/export updates, and reporting dimensions.
- **Phase 2 - Controlled workflow expansion**: offline `CASH` initiation and admin confirmation flow behind a feature flag or per-organization setting.
- **Phase 3 - Operational tooling**: admin printable receipts, pending confirmation queue, bulk posting tools, and school-oriented dashboards.
- **Guardrail**: keep Paystack online checkout as the default path and make all offline payment capabilities opt-in so current organizations and public payment flows do not regress.

## Next Priority
The next item to work on is **Form Targeting System** - aligning backend behavior with the updated PRD form targeting requirements.

"Leave this part out:

#. **Guest Contact Email Verification**: Add email verification flow for guest contacts during form submissions."