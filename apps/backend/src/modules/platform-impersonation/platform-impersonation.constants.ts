/**
 * Platform impersonation (Part 3, Wave B item 9 — IN v1).
 *
 * A platform SUPER operator may open a short-lived, reason-required session that
 * mints a TENANT access token for a specific tenant user, so they can see what
 * the tenant sees. There is deliberately no refresh token: the session (and the
 * token) simply expire, and ending a session revokes the token immediately.
 *
 * Impersonation is gated by a feature flag so it can be switched off globally —
 * or for a single organization — during an incident. When the flag row does not
 * exist at all the feature is treated as ON, matching the "IN v1" decision.
 */

export const IMPERSONATION_STATUSES = ['active', 'ended', 'expired'] as const;
export type ImpersonationStatus = (typeof IMPERSONATION_STATUSES)[number];

/** Feature flag key used as the impersonation kill switch. */
export const IMPERSONATION_FEATURE_FLAG_KEY = 'impersonation';

export const IMPERSONATION_DEFAULT_DURATION_MINUTES = 30;
export const IMPERSONATION_MIN_DURATION_MINUTES = 1;
export const IMPERSONATION_MAX_DURATION_MINUTES = 60;

/** Minimum length of the mandatory "why" recorded for every session. */
export const IMPERSONATION_REASON_MIN_LENGTH = 5;
export const IMPERSONATION_REASON_MAX_LENGTH = 500;

export const IMPERSONATION_NOT_FOUND_MESSAGE = 'Impersonation session not found';
export const IMPERSONATION_ENDED_MESSAGE = 'Impersonation session has ended';
export const IMPERSONATION_EXPIRED_MESSAGE = 'Impersonation session has expired';
export const IMPERSONATION_DISABLED_MESSAGE = 'Impersonation is currently disabled';
