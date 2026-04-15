# Frontend Implementation Plan: Market Readiness Features

This document defines frontend implementation for the next market-readiness features in a way that does not disrupt current user workflows.

Scope covered:
- Checkout Conversion Kit
- Abandoned Payment Recovery
- Installment Plan Profiles
- Arrears/Dunning Experience
- Reconciliation Workspace UI
- Sheets/Zapier Integration UX
- Partner Toolkit UX
- Compliance Export Pack UX

## 1. Frontend Non-Breaking Guardrails

1. Existing pages and routes remain default.
2. New UI appears only when backend feature flags enable it.
3. Preserve old API calls as fallback until rollout completes.
4. Avoid replacing current components in-place during phase 1.
5. Use progressive enhancement: add optional UI blocks first.

## 2. Feature Flag Consumption

Frontend should fetch org capability flags during bootstrap and cache per session.

Suggested capability shape:
- `checkout_v2_enabled`
- `abandoned_recovery_enabled`
- `installments_enabled`
- `arrears_dunning_enabled`
- `reconciliation_workspace_enabled`
- `integrations_enabled`
- `partner_toolkit_enabled`
- `compliance_export_pack_enabled`

UI behavior:
- Hidden when flag OFF.
- Visible but read-only in shadow mode where applicable.

## 3. Module-by-Module UI Plan

## 3.1 Checkout Conversion Kit

### UX goals
- reduce drop-off on public checkout
- improve trust and clarity during payment

### UI implementation
1. Add new checkout component set under `checkout/v2`.
2. Keep existing checkout route; select renderer by capability flag.
3. Add blocks:
   - progress indicator
   - trust strip (secure payment, receipt guarantee)
   - fee/amount summary card
   - clearer error copy and recovery actions

### FE integration
- Keep current submit API.
- Send optional telemetry events if backend session endpoint is available.

## 3.2 Abandoned Payment Recovery

### UI surfaces
- Admin dashboard card: abandoned payments count.
- Recovery queue table:
  - reference
  - payer/contact
  - amount
  - last attempt
  - action buttons (send reminder, mark resolved)

### UX rules
- read-only first in shadow mode.
- only show send actions when capability is fully enabled.

## 3.3 Installment Plan Profiles

### Admin UI
- New section under forms/payments:
  - create plan
  - add plan items (amount + due date)
  - assign contacts/groups

### Contact UI
- installment summary widget:
  - total
  - paid
  - outstanding
  - next due installment

### UX rules
- if no plan on form, fallback to current single-payment view.

## 3.4 Arrears / Dunning Engine

### Admin UI
- arrears dashboard with buckets:
  - `0-30`
  - `31-60`
  - `60+`
- campaign builder:
  - audience filters
  - template
  - preview and run

### UX rules
- provide explicit labels that campaign actions may send reminders.
- require confirmation modal before run.

## 3.5 Reconciliation Workspace

### Admin UI
- run list and period filters
- exceptions table with severity/status badges
- detail drawer with mismatch context and resolution notes

### UX rules
- no destructive actions by default.
- clear distinction between computed exception and confirmed correction.

## 3.6 Sheets/Zapier Integration Path

### Admin UI
- integrations settings page:
  - create endpoint
  - copy webhook secret
  - test delivery
  - view delivery log

### UX rules
- show explicit status (`ACTIVE`, `FAILED`, `RETRYING`).
- provide sample payload viewer and copy action.

## 3.7 Partner Toolkit

### Admin/ops UI
- partner onboarding panel:
  - template selection
  - organization bootstrap checklist
  - onboarding status tracker

### UX rules
- keep partner tools hidden from normal organization admins unless explicitly granted.

## 3.8 Compliance Export Pack

### Admin UI
- export pack request form:
  - scope/date range
  - requester reason note
- jobs table:
  - status (`QUEUED`, `PROCESSING`, `READY`, `FAILED`)
  - created at
  - download action when ready

### UX rules
- asynchronous UX only; no blocking spinners for long jobs.

## 4. Routing and Navigation Additions

Potential new routes (behind flags):
- `/dashboard/recovery`
- `/dashboard/installments`
- `/dashboard/arrears`
- `/dashboard/reconciliation`
- `/dashboard/integrations`
- `/dashboard/partners`
- `/dashboard/compliance-export-pack`

Avoid removing existing navigation items.

## 5. API Client Strategy

1. Add new API methods as separate functions, do not alter existing signatures.
2. For each new method, implement fallback handling for 404/disabled capability.
3. Keep old code path active until flag rollout completes.

## 6. Analytics and Telemetry (Frontend)

Track events:
- checkout step viewed/completed
- checkout submit failed/succeeded
- reminder send clicked
- installment plan created/assigned
- reconciliation exception resolved
- compliance export requested/downloaded

Add feature-flag dimension to events for clean A/B analysis.

## 7. Quality and Testing

1. Component tests for new UI modules.
2. Integration tests for API flows and fallback behavior.
3. E2E tests for:
   - old checkout path (flag OFF)
   - new checkout path (flag ON)
   - critical admin workflows in pilot mode
4. Visual regression checks for new dashboard modules.

## 8. Rollout Playbook (Frontend)

### Stage 1
- ship hidden routes and components behind flags
- no visible change for existing orgs

### Stage 2
- enable internal org/staging tenants
- collect telemetry and UX friction issues

### Stage 3
- pilot institutions only
- weekly review of conversion, recovery, and support tickets

### Stage 4
- phased broader rollout

## 9. Definition of Done (Frontend)

A feature is done only when:
1. Flag-gated and default hidden.
2. Existing UI path still works unchanged.
3. Empty states and error states are handled.
4. FE docs updated and handoff notes shared.
5. Telemetry confirms no regression in baseline checkout/payment completion.
