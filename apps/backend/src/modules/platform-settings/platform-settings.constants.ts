/**
 * Platform settings + feature flags (Part 3, Wave A, Module 5).
 *
 * Two closely related control-plane concepts share this module:
 *
 *  - **Settings** are typed global key/value pairs (e.g. default plan, support
 *    email, maintenance banner text). Provider-related keys are just settings in
 *    the `INTEGRATIONS`/`PAYMENTS` categories, which is how the plan's separate
 *    `provider_settings` table is realised without a third schema.
 *  - **Feature flags** are named booleans with a global default and optional
 *    per-organization overrides, so the platform can gate behaviour and grant or
 *    revoke specific tenants.
 *
 * Keys are normalised to lowercase and restricted so they are safe to use as
 * lookup identifiers and in audit records.
 */

export const PLATFORM_SETTING_VALUE_TYPES = ['string', 'number', 'boolean', 'json'] as const;
export type PlatformSettingValueType = (typeof PLATFORM_SETTING_VALUE_TYPES)[number];

export const PLATFORM_SETTING_CATEGORIES = [
  'GENERAL',
  'EMAIL',
  'PAYMENTS',
  'BILLING',
  'SECURITY',
  'INTEGRATIONS',
] as const;
export type PlatformSettingCategory = (typeof PLATFORM_SETTING_CATEGORIES)[number];

/** Lowercase, starts with a letter, 2–64 chars of `[a-z0-9_.-]`. */
export const PLATFORM_KEY_REGEX = /^[a-z][a-z0-9_.-]{1,63}$/;

export function normalizePlatformKey(key: string): string {
  return (key ?? '').trim().toLowerCase();
}

/** True when a normalised key is well-formed. */
export function isValidPlatformKey(key: string): boolean {
  return PLATFORM_KEY_REGEX.test(key);
}
