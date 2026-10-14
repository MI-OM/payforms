import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { PlatformAuditService } from './platform-audit.service';
import {
  PLATFORM_AUDIT_ACTION_KEY,
  SKIP_PLATFORM_AUDIT_KEY,
  PlatformAuditActionMetadata,
} from './decorators/platform-audit.decorator';

/** Body/query keys whose values must never be written to the audit trail. */
const REDACTED_KEYS = [
  'password',
  'current_password',
  'new_password',
  'password_hash',
  'refresh_token',
  'access_token',
  'token',
  'secret',
  'client_secret',
  'api_key',
  'api_secret',
  'authorization',
  'otp',
  'pin',
  'code',
];

const MAX_METADATA_STRING = 2000;

/**
 * Writes a platform-level audit entry for every mutating (and explicitly
 * annotated) request handled by the controller it is attached to.
 *
 * Attach it with `@UseInterceptors(PlatformAuditInterceptor)` on platform
 * controllers. It only ever runs for paths under `/platform`, so tenant traffic
 * is never touched (the global tenant `AuditInterceptor` continues to handle
 * organisation-scoped requests).
 *
 * Both successful and failed requests are recorded. Auditing failures (e.g. a
 * rejected login, a forbidden action) are often the most interesting events, so
 * the interceptor taps the error path as well as the success path. Persisting
 * is best-effort and never affects the response.
 */
@Injectable()
export class PlatformAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const fullPath: string = (req.originalUrl || req.url || '').split('?')[0];
    // Safety net: never audit non-platform traffic even if this interceptor is
    // applied more broadly than intended.
    if (!fullPath.startsWith('/platform')) {
      return next.handle();
    }

    const handler = context.getHandler();
    const skip = this.reflector.get<boolean>(SKIP_PLATFORM_AUDIT_KEY, handler);
    if (skip) {
      return next.handle();
    }

    const annotation = this.reflector.get<PlatformAuditActionMetadata>(
      PLATFORM_AUDIT_ACTION_KEY,
      handler,
    );
    const method = (req.method || 'GET').toUpperCase();

    // Audit every mutation by default; audit reads only when explicitly
    // annotated, to keep the trail high-signal.
    const shouldAudit = Boolean(annotation) || method !== 'GET';
    if (!shouldAudit) {
      return next.handle();
    }

    const base = this.buildBase(req, fullPath, method, annotation);

    return next.handle().pipe(
      tap((body) => {
        void this.platformAudit.record({
          ...base,
          ...this.resolveActor(req, body),
          statusCode: res.statusCode ?? 200,
          metadata: this.buildMetadata(req, null),
        });
      }),
      catchError((error) => {
        void this.platformAudit.record({
          ...base,
          statusCode: this.resolveStatusCode(error),
          metadata: this.buildMetadata(req, error),
        });
        return throwError(() => error);
      }),
    );
  }

  private buildBase(
    req: any,
    fullPath: string,
    method: string,
    annotation?: PlatformAuditActionMetadata,
  ) {
    const user = req.user;
    const resourceType =
      annotation?.resourceType || this.deriveResourceType(fullPath);
    return {
      actorId: user?.id ?? null,
      actorEmail: user?.email ?? null,
      actorRole: user?.role ?? null,
      action: annotation?.action || this.deriveAction(method, resourceType),
      resourceType,
      resourceId: this.deriveResourceId(req),
      method,
      path: fullPath,
      ipAddress: this.resolveIp(req),
      userAgent: (req.headers?.['user-agent'] as string) || null,
    };
  }

  /**
   * Determines who performed the action. Guarded endpoints carry the principal
   * on `req.user`. Unauthenticated endpoints that *establish* an identity as
   * part of the request (login, token refresh) return it as `body.user`; we use
   * that so a successful login is attributed to the admin who logged in, while
   * a failed login correctly has no actor.
   */
  private resolveActor(req: any, body: any) {
    const user = req?.user;
    if (user?.id) {
      return {
        actorId: user.id ?? null,
        actorEmail: user.email ?? null,
        actorRole: user.role ?? null,
      };
    }
    const bodyUser = body?.user;
    if (bodyUser && typeof bodyUser === 'object' && bodyUser.id) {
      return {
        actorId: bodyUser.id ?? null,
        actorEmail: bodyUser.email ?? null,
        actorRole: bodyUser.role ?? null,
      };
    }
    return { actorId: null, actorEmail: null, actorRole: null };
  }

  /** Turns `/platform/organizations/abc` into `Organization`. */
  private deriveResourceType(fullPath: string): string | null {
    const segments = fullPath.split('/').filter(Boolean);
    // segments[0] === 'platform'
    const raw = segments[1];
    if (!raw) {
      return null;
    }
    const singular = raw.endsWith('s') ? raw.slice(0, -1) : raw;
    return singular
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  private deriveAction(method: string, resourceType: string | null): string {
    const verb =
      {
        POST: 'CREATE',
        PUT: 'UPDATE',
        PATCH: 'UPDATE',
        DELETE: 'DELETE',
        GET: 'VIEW',
      }[method] || method;
    const resource = (resourceType || 'PLATFORM').toUpperCase();
    return `${verb} ${resource}`;
  }

  private deriveResourceId(req: any): string | null {
    const params = req.params || {};
    return (
      params.id ||
      params.organizationId ||
      params.userId ||
      params.auditLogId ||
      null
    );
  }

  private resolveIp(req: any): string | null {
    return (
      req.headers?.['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      null
    );
  }

  private resolveStatusCode(error: any): number {
    return error?.status ?? error?.statusCode ?? 500;
  }

  private buildMetadata(req: any, error: any): Record<string, any> {
    const metadata: Record<string, any> = {
      params: this.sanitize(req.params || {}),
      query: this.sanitize(req.query || {}),
    };
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
      metadata.body = this.sanitize(req.body);
    }
    if (error) {
      metadata.error = {
        name: error?.name ?? null,
        message: error?.message ?? String(error),
        status: this.resolveStatusCode(error),
      };
    }
    return metadata;
  }

  /** Deep-clones a value, redacting sensitive keys and truncating long strings. */
  private sanitize(value: any, depth = 0): any {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'string') {
      return value.length > MAX_METADATA_STRING
        ? `${value.slice(0, MAX_METADATA_STRING)}…[truncated]`
        : value;
    }
    if (typeof value !== 'object') {
      return value;
    }
    if (depth > 6) {
      return '[depth-limit]';
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item, depth + 1));
    }
    const output: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      if (REDACTED_KEYS.includes(key.toLowerCase())) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = this.sanitize(val, depth + 1);
      }
    }
    return output;
  }
}
