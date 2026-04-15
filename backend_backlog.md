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

## Market Gap Analysis (Backlog Additions)

### Competitive Baseline (What similar tools do well)
- **Form + payment leaders** (Typeform/Jotform/Tally + Stripe): conversion-optimized checkout UX, clean hosted payment pages, strong templates.
- **Africa-focused collections tools** (Paystack/Flutterwave ecosystems, school ERPs): local rails support, reconciliation, and offline-aware operations.
- **School fee platforms** (regional school billing tools): installment plans, arrears visibility, parent communication loops, and bulk operations.

### Gaps in Payforms vs market expectations
1. **Checkout conversion optimization gap**
	- Missing A/B-tested checkout patterns, trust indicators, and abandoned-payment recovery loops.
2. **Collections operations gap**
	- Limited dunning/reminder automation, limited arrears campaign tooling, and no smart retries by segment.
3. **Distribution/integration gap**
	- Lightweight API exists, but there are no no-code connectors (Sheets/Zapier), embeddable admin widgets, or partner onboarding tooling.
4. **Procurement/readiness gap for institutions**
	- Need stronger compliance artifacts (audit export packs, policy templates, data retention controls surfaced for non-technical buyers).
5. **Go-to-market proof gap**
	- Need benchmark metrics and packaged “first 30 days” implementation playbook for schools and associations.

## New Backlog Items: Market Readiness

### Product and Platform
1. **Checkout Conversion Kit**
	- Add trust blocks, fee transparency card, progress indicators, and simplified payment-step UX for hosted/public forms.
2. **Abandoned Payment Recovery**
	- Add reminder workflows for initiated-but-unpaid references (email/WhatsApp-ready payload hooks).
3. **Installment Plan Profiles**
	- Add configurable installment plans per form/session with due-date and penalty metadata.
4. **Arrears and Dunning Engine**
	- Add aging buckets (`0-30`, `31-60`, `60+`) and campaign triggers by segment/group.
5. **Reconciliation Workspace**
	- Add daily reconciliation board (gateway events vs ledger state) with exception queues.

### Ecosystem and Integrations
6. **Google Sheets + CSV Sync Connector**
	- Push transaction and contact updates to Sheets; pull controlled contact updates with validation logs.
7. **Webhook Templates + Zapier/Make Starter**
	- Provide template payload docs and one-click recipes for schools/SMEs.
8. **Partner/Reseller Tenant Toolkit**
	- Add multi-tenant onboarding presets, branded implementation checklist, and account bootstrap scripts.

### Trust and Enterprise Readiness
9. **Compliance Export Pack**
	- One-click package: audit logs, payment logs, data-access reports, retention policy snapshot.
10. **SLA/Status and Incident Communication Hooks**
	- Add status endpoints + incident notice broadcast path for institutional customers.

## Easy Market Entry Strategy (Execution Plan)

### ICP (Initial target)
- **Primary**: private K-12 schools, tutorial colleges, exam prep centers, and associations with frequent fee collections.
- **Secondary**: training academies and church/community organizations collecting recurring contributions.

### Positioning
- "Fastest way to launch branded school/association collections with online + offline reconciliation in one workflow."

### Phase 0 (Weeks 1-2): Launch Readiness
1. Package one opinionated vertical template: "School Fees Collection Starter".
2. Publish implementation guide: setup keys, forms, contact import, offline queue, receipts, reports.
3. Define success metrics dashboard:
	- form-to-payment conversion
	- partial-to-complete settlement rate
	- days-to-first-value (organization signup to first successful collection)

### Phase 1 (Weeks 3-6): Beachhead Acquisition
1. Recruit 5-10 pilot institutions in one city/region.
2. Offer concierge onboarding (data import + first form setup within 48 hours).
3. Weekly pilot review cadence with product telemetry and friction log.
4. Publish 2 short case studies with measurable outcomes.

### Phase 2 (Weeks 7-12): Repeatable Growth Loop
1. Launch referral motion: discounts for school-to-school introductions.
2. Partner with implementation consultants/IT admins already serving schools.
3. Add "migration assist" offer from spreadsheets/manual bank tracking.
4. Standardize a 30-minute demo script and ROI calculator.

### Pricing and Packaging (Entry simplicity)
1. **Starter**: low platform fee + capped transactions, ideal for first term/session.
2. **Growth**: adds arrears automation, reconciliation workspace, and export packs.
3. **Institutional**: audit/compliance package, advanced support, onboarding SLA.

### Market Entry Risks and Mitigations
1. **Risk**: slow onboarding due to data quality.
	- **Mitigation**: import validator + assisted cleanup templates.
2. **Risk**: fear of payment disruption.
	- **Mitigation**: phased rollout with parallel run and offline fallback queue.
3. **Risk**: feature parity pressure from incumbents.
	- **Mitigation**: win on speed-of-setup, local operations workflow, and transparent support.

## Next Priority
The next item to work on is **Checkout Conversion Kit + Abandoned Payment Recovery** to strengthen early market entry outcomes while preserving current school-focused payment operations work.

"Leave this part out:

#. **Guest Contact Email Verification**: Add email verification flow for guest contacts during form submissions."