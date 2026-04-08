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

## Next Priority
The next item to work on is **Form Targeting System** - aligning backend behavior with the updated PRD form targeting requirements.

"Leave this part out:

#. **Guest Contact Email Verification**: Add email verification flow for guest contacts during form submissions."