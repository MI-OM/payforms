# Post-MVP Features and Modules (Working Draft)

This is a temporary planning document for the next phase after MVP.

## Goals

- Scale multi-tenant onboarding (subdomain + custom domain support).
- Strengthen contact authentication and tenant scoping.
- Improve engagement (group-based notifications and campaigns).
- Improve decision support (form and transaction performance analytics).
- Add enterprise-grade controls without breaking current production flow.

## Current Baseline (already in place)

- Organization-owned Paystack keys and payment collection flow.
- Contact/group/form/submission/payment core modules.
- Group-based notification endpoints.
- Form performance summary endpoint.
- Tenant context groundwork (`organization_subdomain`, `organization_domain`, host inference).

## Priority Roadmap

## Phase 1: Stabilize Core Multi-Tenant + Contact Auth

### 1) Tenant Resolution Module

- Purpose: reliably identify organization context from request host or explicit tenant hint.
- Scope:
  - Resolve tenant in this order:
    1. `organization_domain`
    2. `organization_subdomain + TENANT_BASE_DOMAIN`
    3. explicit fallback field (`organization_id`) for legacy clients
  - Add strict tenant mismatch rejection for contact login/reset flows.
- Deliverables:
  - Shared `TenantResolverService`.
  - Guard/middleware for host-based tenant checks.
  - Audit log entries for tenant resolution and mismatches.

### 2) Contact Auth Hardening Module

- Purpose: remove ambiguity in how contacts authenticate across organizations.
- Scope:
  - Ensure password reset tokens are tenant-bound.
  - Ensure contact login requires resolved tenant context.
  - Add lockout/rate-limit policy for repeated failed auth attempts.
  - Add token invalidation strategy for password reset and force-reset workflows.
- Deliverables:
  - Updated `contact-auth` service/controller validation rules.
  - Auth security tests for cross-tenant attempts.

## Phase 2: Notification and Engagement

### 3) Notification Campaigns Module

- Purpose: move from one-off sends to reusable communication workflows.
- Scope:
  - Reusable templates (subject/body with variables).
  - Group-targeted sends (already present as baseline).
  - Scheduled sends and retry policy.
  - Delivery status tracking per recipient.
- Deliverables:
  - `notification_templates` table.
  - `notification_campaigns` + `notification_deliveries` tables.
  - Endpoints:
    - `POST /notifications/campaigns`
    - `POST /notifications/campaigns/:id/send`
    - `GET /notifications/campaigns/:id/deliveries`

### 4) Defaulter Workflow Module

- Purpose: support school-style reminder workflows (defaulters group, escalation).
- Scope:
  - Dynamic group filters from payment state (e.g., unpaid by due date).
  - Snapshot and live group options.
  - One-click reminder campaign to generated groups.
- Deliverables:
  - `GET /groups/derived/defaulters`
  - `POST /notifications/reminder/defaulters`

## Phase 3: Performance and Reporting

### 5) Form Performance v2 Module

- Purpose: give org admins actionable conversion and collection insights.
- Scope:
  - Extend per-form metrics with:
    - attempted vs completed payments
    - success/failure rates by date window
    - group-wise split
    - channel/source metadata (widget vs direct)
  - Export performance reports.
- Deliverables:
  - Additional report endpoint variants:
    - `GET /reports/forms/performance/groups`
    - `GET /reports/forms/performance/timeseries`
  - CSV/PDF export for form performance.

### 6) Dashboard Analytics Module

- Purpose: unified metrics layer for FE dashboards.
- Scope:
  - KPI cards and trends from a single service contract.
  - Cached aggregations for high-traffic orgs.
- Deliverables:
  - `GET /reports/dashboard`
  - cache key strategy by org/date range.

## Phase 4: Platform and Enterprise

### 7) Domain Management Module

- Purpose: enable production use of custom domains safely.
- Scope:
  - Domain verification (DNS challenge).
  - SSL/TLS readiness checks.
  - Domain status lifecycle (`PENDING`, `VERIFIED`, `ACTIVE`, `FAILED`).
- Deliverables:
  - Endpoints:
    - `POST /organization/domains`
    - `POST /organization/domains/:id/verify`
    - `GET /organization/domains`

### 8) Billing and Plan Controls Module

- Purpose: enforce subscription limits and monetization.
- Scope:
  - Plan quotas (forms, contacts, staff, sends).
  - Usage metering.
  - Soft/hard limit enforcement.
- Deliverables:
  - `billing` module with usage checks integrated into core services.

### 9) Compliance and Security Module

- Purpose: support larger institutions and audits.
- Scope:
  - Data retention controls.
  - PII export/delete workflows.
  - Security event stream and admin alerts.
- Deliverables:
  - Admin-only compliance endpoints and audit extensions.

## Data Model Additions (proposed)

- `notification_templates`
- `notification_campaigns`
- `notification_deliveries`
- `organization_domains` (if domain history/multi-domain is needed)
- `tenant_resolution_logs` (optional if not folded into audit log metadata)

## Rollout Safety (do not break current infra)

- Use additive migrations only (new nullable columns/tables first).
- Keep legacy request fields valid during transition (`organization_id` fallback).
- Gate new behavior with feature flags:
  - `FEATURE_TENANT_HOST_ENFORCEMENT`
  - `FEATURE_NOTIFICATION_CAMPAIGNS`
  - `FEATURE_FORM_PERF_V2`
- Deploy in this order:
  1. Schema migration
  2. Backward-compatible code
  3. Flag enablement per organization
  4. Legacy path deprecation

## Suggested Implementation Order

1. Tenant Resolution Module
2. Contact Auth Hardening Module
3. Notification Campaigns Module
4. Form Performance v2 Module
5. Domain Management Module
6. Billing and Compliance Modules

## Exit Criteria for Post-MVP Phase

- Contact auth fully tenant-scoped with tests for cross-tenant rejection.
- Group campaigns send reliably with delivery tracking.
- Form performance reports provide per-form and grouped insights.
- Organizations can onboard with subdomain or verified custom domain.
- No breaking changes to existing API consumers during rollout.
