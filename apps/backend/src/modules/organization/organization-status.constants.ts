/**
 * Organization lifecycle status (Part 3, Wave A, Module 3).
 *
 * `active`    — normal operation.
 * `suspended` — temporary hard stop, optionally time-boxed via `suspended_until`.
 * `disabled`  — indefinite hard stop (offboarding / abuse).
 *
 * The hard stop (locked decision 2026-10-14) blocks BOTH tenant login and the
 * public payment forms. Enforcement lives in `OrganizationStatusService`, which
 * every entry point (tenant auth, public forms) calls.
 */
export type OrganizationStatus = 'active' | 'suspended' | 'disabled';

export const ORGANIZATION_STATUSES: OrganizationStatus[] = [
  'active',
  'suspended',
  'disabled',
];

/** Statuses that trigger the hard stop. */
export const BLOCKING_ORGANIZATION_STATUSES: OrganizationStatus[] = [
  'suspended',
  'disabled',
];
