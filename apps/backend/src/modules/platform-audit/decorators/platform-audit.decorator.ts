import { SetMetadata } from '@nestjs/common';

export const PLATFORM_AUDIT_ACTION_KEY = 'platform_audit_action';
export const SKIP_PLATFORM_AUDIT_KEY = 'skip_platform_audit';

export interface PlatformAuditActionMetadata {
  action: string;
  resourceType?: string;
}

/**
 * Gives a handler a readable audit label (and optional resource type).
 *
 * Annotating a handler also forces it to be audited even when it is a `GET`,
 * which the interceptor otherwise skips to avoid noise.
 *
 *   @PlatformAuditAction('DISABLE ORGANIZATION', 'Organization')
 */
export const PlatformAuditAction = (action: string, resourceType?: string) =>
  SetMetadata<string, PlatformAuditActionMetadata>(PLATFORM_AUDIT_ACTION_KEY, {
    action,
    resourceType,
  });

/**
 * Opts a handler out of platform auditing. Use for high-frequency, low-signal
 * endpoints (e.g. light polling).
 */
export const SkipPlatformAudit = () =>
  SetMetadata<string, boolean>(SKIP_PLATFORM_AUDIT_KEY, true);
