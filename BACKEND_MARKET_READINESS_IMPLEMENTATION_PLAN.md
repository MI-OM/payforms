# Backend Implementation Plan: Market Readiness Features

This document defines how backend should implement the next market-readiness features without breaking the current production flow.

Scope covered:
- Checkout Conversion Kit (backend support)
- Abandoned Payment Recovery
- Installment Plan Profiles
- Arrears/Dunning Engine
- Reconciliation Workspace
- Sheets/Zapier Integration Path
- Partner Toolkit
- Compliance Export Pack

## 1. Non-Breaking Implementation Guardrails

1. Additive schema only in first rollout.
2. Existing endpoints and response contracts remain unchanged.
3. New capabilities are feature-flagged per organization.
4. Heavy operations run in async workers/queues.
5. Shadow mode before user-visible activation.
6. Rollback path must be available for every feature.

## 2. Feature Flag Strategy

Create organization-level flags (default `false`):
- `ff_checkout_v2`
- `ff_abandoned_recovery`
- `ff_installments`
- `ff_arrears_dunning`
- `ff_reconciliation_workspace`
- `ff_integrations_outbound_webhooks`
- `ff_partner_toolkit`
- `ff_compliance_export_pack`

Implementation note:
- Resolve flags early in request context and pass to services.
- Never branch with env-only flags for tenant behavior.

## 3. Data Model Additions (Phase 1 Additive)

### 3.1 Checkout telemetry support
- `checkout_sessions`
  - `id`, `organization_id`, `form_id`, `contact_id?`, `payment_reference?`, `status`, `started_at`, `completed_at?`, `metadata`

### 3.2 Abandoned recovery
- `payment_recovery_candidates`
  - `id`, `organization_id`, `payment_id`, `reference`, `detected_at`, `status`, `last_notified_at?`, `attempt_count`, `metadata`
- `payment_recovery_events`
  - per notification attempt/audit trail

### 3.3 Installments
- `installment_plans`
  - `id`, `organization_id`, `form_id`, `name`, `currency`, `total_amount`, `active`, `created_at`
- `installment_plan_items`
  - `id`, `plan_id`, `label`, `amount`, `due_date`, `penalty_rule?`, `order_index`
- `contact_installment_accounts`
  - `id`, `organization_id`, `contact_id`, `plan_id`, `outstanding_amount`, `status`

### 3.4 Arrears / dunning
- `dunning_campaigns`
  - `id`, `organization_id`, `name`, `active`, `config`
- `dunning_runs`
  - `id`, `organization_id`, `campaign_id`, `started_at`, `completed_at?`, `summary`
- `arrears_snapshots`
  - `id`, `organization_id`, `contact_id`, `as_of_date`, `bucket_0_30`, `bucket_31_60`, `bucket_61_plus`, `total_outstanding`

### 3.5 Reconciliation
- `reconciliation_runs`
  - `id`, `organization_id`, `period_start`, `period_end`, `status`, `summary`
- `reconciliation_exceptions`
  - `id`, `run_id`, `payment_id?`, `reference?`, `type`, `severity`, `status`, `details`

### 3.6 Integrations
- `integration_endpoints`
  - `id`, `organization_id`, `type` (`WEBHOOK`, `SHEETS`), `target`, `secret`, `active`, `config`
- `integration_deliveries`
  - `id`, `endpoint_id`, `event_type`, `payload_hash`, `status`, `attempts`, `last_error?`, `delivered_at?`

### 3.7 Partner toolkit
- `partners`
  - `id`, `name`, `status`, `config`
- `partner_tenants`
  - mapping partner to organizations and bootstrap metadata

### 3.8 Compliance export pack
- `compliance_export_jobs`
  - `id`, `organization_id`, `requested_by_user_id`, `status`, `scope`, `created_at`, `completed_at?`, `download_url?`
- `compliance_export_artifacts`
  - generated file pointers and checksums

## 4. API Plan (Additive Endpoints)

## 4.1 Checkout conversion support
- `POST /checkout/sessions`
- `PATCH /checkout/sessions/:id`
- `GET /checkout/sessions/metrics`

## 4.2 Abandoned recovery
- `GET /payments/recovery/candidates`
- `POST /payments/recovery/:id/notify`
- `POST /payments/recovery/run` (admin-triggered, plus cron worker)

## 4.3 Installments
- `POST /installments/plans`
- `GET /installments/plans`
- `GET /installments/plans/:id`
- `PATCH /installments/plans/:id`
- `POST /installments/plans/:id/assign-contacts`
- `GET /installments/accounts`

## 4.4 Arrears / dunning
- `GET /dunning/arrears-summary`
- `POST /dunning/campaigns`
- `GET /dunning/campaigns`
- `POST /dunning/campaigns/:id/run`
- `GET /dunning/runs/:id`

## 4.5 Reconciliation workspace
- `POST /reconciliation/runs`
- `GET /reconciliation/runs`
- `GET /reconciliation/runs/:id/exceptions`
- `PATCH /reconciliation/exceptions/:id`

## 4.6 Integrations
- `POST /integrations/endpoints`
- `GET /integrations/endpoints`
- `PATCH /integrations/endpoints/:id`
- `GET /integrations/deliveries`

## 4.7 Partner toolkit
- `POST /partners`
- `GET /partners`
- `POST /partners/:id/onboard-organization`

## 4.8 Compliance export pack
- `POST /compliance/export-pack`
- `GET /compliance/export-pack/jobs`
- `GET /compliance/export-pack/jobs/:id`

## 5. Queue/Worker Design

Use queue workers for:
- abandoned detection and reminders
- dunning campaign execution
- reconciliation computations
- integration delivery retries
- compliance export generation

Rules:
1. Idempotency key per job payload.
2. Dead-letter queue for repeated failures.
3. Metrics for success/failure/latency.

## 6. Compatibility Rules

1. Existing payment flow remains default.
2. Existing `POST /public/forms/:slug/submit` behavior must not change for tenants with flags off.
3. Existing report endpoints must keep contract shape.
4. New response fields must be optional and additive.

## 7. Rollout Phases

### Phase A: Foundation
- migrations + flags + internal services
- no user-visible features

### Phase B: Shadow Mode
- run abandoned detection, arrears snapshots, reconciliation in read-only
- compare outputs and tune logic

### Phase C: Pilot Tenants
- enable 1-2 capabilities per pilot tenant
- manual monitoring + rollback plan

### Phase D: Broader Rollout
- gradual activation cohort by cohort

## 8. Testing Requirements

1. Unit tests for each service and rule engine.
2. Integration tests for new endpoints and migrations.
3. Contract tests to ensure old endpoints remain unchanged.
4. Worker idempotency and retry tests.
5. Load test for reconciliation/export jobs.

## 9. Observability and Alerting

Add metrics:
- checkout conversion by form
- abandoned recovery candidate count and notify success rate
- arrears bucket drift
- reconciliation exception rates
- integration delivery success rate
- compliance export generation time

Add alerts on:
- queue failures
- delivery retry spikes
- export job timeout failures

## 10. Definition of Done (Backend)

A feature is done only when:
1. Flag-gated and default-off.
2. Migrations reversible.
3. Unit + integration tests pass.
4. Docs updated in `backend_api_endpoints.md`.
5. Pilot run completed with no regression on existing payment path.
