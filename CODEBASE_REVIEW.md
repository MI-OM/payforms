# Codebase Review

## Overall

The codebase has a solid functional base: clear module separation, tenant-aware data access patterns, and several useful database indexes already exist. The main risks are not basic CRUD quality. They are production hardening, scale behavior under load, and a few "feature-complete on paper" areas that are still MVP implementations.

## 1. Scalability

### What is good
- Core entities already have useful indexes for tenant lookups, payments, forms, submissions, contacts, and audit logs.
- The backend uses a configurable Postgres pool.
- Redis support exists.

### Gaps
- Cache fallback is per-instance memory, so horizontally scaled backend instances will serve inconsistent cache state if Redis is unavailable.
- Large exports and reports build full datasets in memory before returning CSV/PDF. This will become expensive for large schools.
- Scheduled work is not really asynchronous yet. Notifications marked as scheduled are sent immediately, and retention cleanup appears to be manual rather than job-driven.
- Readiness checks are placeholders and do not verify database, Redis, mail, or payment provider reachability.
- Webhook signature validation loops through all organizations with Paystack keys. That is $O(n)$ per webhook and will degrade as tenant count grows.

### Recommendations
- Make Redis mandatory in production or disable cache features when Redis is unavailable.
- Move exports, scheduled notifications, retention purge, and heavy report generation to background jobs/queues.
- Stream large CSV/PDF exports instead of loading full result sets into memory.
- Implement real readiness checks for DB, Redis, mail, and Paystack configuration.
- Store webhook secrets in a way that avoids scanning all tenants for every incoming webhook.

## 2. Code Optimization

### Findings
- Several list and analytics flows use `findAndCount`, joined queries, and full object hydration. This is fine at small scale but will get expensive with large tenants.
- Some services fetch full related entities where projections would be enough.
- The frontend API client is a single large class and keeps auth/session logic tightly coupled to request transport.
- There is little evidence of automated performance validation or regression checks.

### Recommendations
- Use `select` projections for admin lists and reporting endpoints where full entities are not needed.
- Introduce cursor-based pagination for high-volume tables like payments, submissions, audit logs, and contacts.
- Split frontend API concerns into auth, organization, contacts, payments, and reporting clients.
- Add basic performance tests for reports, exports, payment verification, and public form submission.

## 3. Core Missing Gaps

### Findings
- There is no meaningful automated test coverage in source. I did not find backend spec files or frontend test files.
- There is no CI workflow in the repository.
- Scheduled notifications are not actually scheduled yet; the endpoint sends immediately and the scheduled list endpoint returns empty.
- Billing usage metrics are partly placeholders and currently return zeros for several usage dimensions.
- Data retention logic exists, but there is no visible recurring scheduler/worker to enforce it automatically.
- Health readiness is still a stub rather than an operational signal.
- Monitoring and alerting are minimal. I did not find structured application telemetry such as Sentry, OpenTelemetry, or Prometheus metrics.

### Recommendations
- Add a minimum CI pipeline: install, build, lint, and core tests.
- Add integration tests for auth, tenant isolation, payments, reports, and public forms.
- Either implement real scheduling/queue support or rename the notification endpoints so they do not imply delayed delivery.
- Finish billing usage calculation before enforcing plan limits from it.
- Run retention purge through a scheduled worker and expose last-run status.
- Add error monitoring and basic metrics before wider production scale.

## 4. Core Security Gaps

### Findings
- Swagger docs are exposed at `/api/docs` without an environment gate.
- I did not find global rate limiting/throttling for admin auth or public endpoints. This increases brute-force and abuse risk.
- The frontend stores access tokens in `localStorage`, which increases exposure to token theft if an XSS bug appears.
- Password reset and verification tokens appear to be stored in plaintext in the database rather than as hashes.
- Password reset flows return user-not-found style errors, which can enable account enumeration.
- I did not find `helmet` or equivalent HTTP hardening headers in the backend bootstrap.

### Recommendations
- Gate Swagger to non-production or protect it with authentication.
- Add rate limiting for login, password reset, public forms, and webhook endpoints.
- Move auth to secure httpOnly cookies if feasible, or at minimum reduce token lifetime and harden CSP/XSS defenses.
- Store reset and verification tokens as hashes, not plaintext values.
- Make password-reset and auth-recovery responses generic so they do not reveal whether an account exists.
- Add security headers with `helmet` and review CSP, frame, and referrer policies.

## Priority Order

1. Add production security hardening: rate limiting, Swagger gating, token handling, security headers.
2. Add CI and automated tests for payments, tenancy, auth, and reporting.
3. Move fake-scheduled and heavy operations to background jobs.
4. Improve readiness, monitoring, and observability.
5. Optimize large exports/reports for high-volume tenants.