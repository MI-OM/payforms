import { ForbiddenException } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { PlatformAuditInterceptor } from './platform-audit.interceptor';
import {
  PLATFORM_AUDIT_ACTION_KEY,
  SKIP_PLATFORM_AUDIT_KEY,
} from './decorators/platform-audit.decorator';

describe('PlatformAuditInterceptor', () => {
  let service: { record: jest.Mock };
  let reflector: { get: jest.Mock };
  let interceptor: PlatformAuditInterceptor;

  const handler = jest.fn(() => 'handled');

  const baseReq = {
    method: 'POST',
    originalUrl: '/platform/organizations',
    url: '/platform/organizations',
    headers: { 'user-agent': 'jest', 'x-forwarded-for': '1.2.3.4' },
    user: { id: 'platform-1', email: 'admin@payforms.com.ng', role: 'SUPER' },
    params: {},
    query: {},
    body: {},
  };

  const baseRes = {
    statusCode: 201,
  };

  function makeContext(req: any, res: any, nextHandler = handler) {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      getHandler: () => nextHandler,
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = { record: jest.fn() };
    reflector = {
      get: jest.fn((key: string) => {
        if (key === SKIP_PLATFORM_AUDIT_KEY) {
          return undefined;
        }
        if (key === PLATFORM_AUDIT_ACTION_KEY) {
          return undefined;
        }
        return undefined;
      }),
    };
    interceptor = new PlatformAuditInterceptor(reflector as any, service as any);
  });

  it('does not audit non-platform paths', async () => {
    const req = { ...baseReq, originalUrl: '/auth/login', url: '/auth/login' };
    const res = { statusCode: 200 };

    const result = await firstValueFrom(
      interceptor.intercept(makeContext(req, res), {
        handle: () => of({ ok: true }),
      }),
    );

    expect(result).toEqual({ ok: true });
    expect(service.record).not.toHaveBeenCalled();
  });

  it('does not audit GET requests that lack an explicit audit action', async () => {
    const req = { ...baseReq, method: 'GET', originalUrl: '/platform/auth/me' };
    const res = { statusCode: 200 };

    await firstValueFrom(
      interceptor.intercept(makeContext(req, res), {
        handle: () => of({ profile: { id: 'platform-1' } }),
      }),
    );

    expect(service.record).not.toHaveBeenCalled();
  });

  it('audits mutating requests and records the resulting status', async () => {
    const req = { ...baseReq, method: 'POST', originalUrl: '/platform/organizations' };
    const res = { statusCode: 201 };

    await firstValueFrom(
      interceptor.intercept(makeContext(req, res), {
        handle: () => of({ id: 'org-1' }),
      }),
    );

    expect(service.record).toHaveBeenCalledTimes(1);
    const record = service.record.mock.calls[0][0];
    expect(record.action).toBe('CREATE ORGANIZATION');
    expect(record.resourceType).toBe('Organization');
    expect(record.method).toBe('POST');
    expect(record.path).toBe('/platform/organizations');
    expect(record.actorId).toBe('platform-1');
    expect(record.actorEmail).toBe('admin@payforms.com.ng');
    expect(record.actorRole).toBe('SUPER');
    expect(record.statusCode).toBe(201);
    expect(record.ipAddress).toBe('1.2.3.4');
    expect(record.metadata.params).toEqual({});
    expect(record.metadata.query).toEqual({});
  });

  it('uses the annotated action and resource type when present', async () => {
    reflector.get.mockImplementation((key: string) => {
      if (key === PLATFORM_AUDIT_ACTION_KEY) {
        return { action: 'PLATFORM ADMIN LOGIN', resourceType: 'PlatformUser' };
      }
      if (key === SKIP_PLATFORM_AUDIT_KEY) {
        return undefined;
      }
      return undefined;
    });

    const req = {
      ...baseReq,
      method: 'POST',
      originalUrl: '/platform/auth/login',
      body: { email: 'admin@payforms.com.ng', password: 'secret' },
    };
    const res = { statusCode: 200 };

    await firstValueFrom(
      interceptor.intercept(makeContext(req, res), {
        handle: () => of({ access_token: 't' }),
      }),
    );

    expect(service.record).toHaveBeenCalledTimes(1);
    const record = service.record.mock.calls[0][0];
    expect(record.action).toBe('PLATFORM ADMIN LOGIN');
    expect(record.resourceType).toBe('PlatformUser');
    expect(record.statusCode).toBe(200);
  });

  it('audits an explicitly annotated GET', async () => {
    reflector.get.mockImplementation((key: string) => {
      if (key === PLATFORM_AUDIT_ACTION_KEY) {
        return { action: 'VIEW PLATFORM AUDIT LOGS', resourceType: 'PlatformAuditLog' };
      }
      return undefined;
    });

    const req = { ...baseReq, method: 'GET', originalUrl: '/platform/audit-logs' };
    const res = { statusCode: 200 };

    await firstValueFrom(
      interceptor.intercept(makeContext(req, res), {
        handle: () => of({ data: [] }),
      }),
    );

    expect(service.record).toHaveBeenCalledTimes(1);
    const record = service.record.mock.calls[0][0];
    expect(record.action).toBe('VIEW PLATFORM AUDIT LOGS');
  });

  it('respects @SkipPlatformAudit', async () => {
    reflector.get.mockImplementation((key: string) => {
      if (key === SKIP_PLATFORM_AUDIT_KEY) {
        return true;
      }
      return undefined;
    });

    const req = { ...baseReq, method: 'POST', originalUrl: '/platform/auth/refresh' };
    const res = { statusCode: 200 };

    await firstValueFrom(
      interceptor.intercept(makeContext(req, res), {
        handle: () => of({ access_token: 'new' }),
      }),
    );

    expect(service.record).not.toHaveBeenCalled();
  });

  it('redacts sensitive fields from request body and metadata is safe', async () => {
    const req = {
      ...baseReq,
      method: 'POST',
      originalUrl: '/platform/auth/login',
      body: {
        email: 'admin@payforms.com.ng',
        password: 'secret',
        refresh_token: 'rt',
        token: 't',
        nested: { api_key: 'k', payload: { otp: '123' } },
      },
    };
    const res = { statusCode: 200 };

    await firstValueFrom(
      interceptor.intercept(makeContext(req, res), {
        handle: () => of({ ok: true }),
      }),
    );

    expect(service.record).toHaveBeenCalledTimes(1);
    const record = service.record.mock.calls[0][0];
    expect(record.metadata.body.email).toBe('admin@payforms.com.ng');
    expect(record.metadata.body.password).toBe('[REDACTED]');
    expect(record.metadata.body.refresh_token).toBe('[REDACTED]');
    expect(record.metadata.body.token).toBe('[REDACTED]');
    expect(record.metadata.body.nested.api_key).toBe('[REDACTED]');
    expect(record.metadata.body.nested.payload.otp).toBe('[REDACTED]');
  });

  it('captures the actor as null when the request has no authenticated user', async () => {
    const req = {
      ...baseReq,
      method: 'POST',
      originalUrl: '/platform/auth/login',
      user: undefined,
      headers: {},
      body: { email: 'attempt@payforms.com.ng', password: 'bad' },
    };
    const res = { statusCode: 401 };

    await firstValueFrom(
      interceptor.intercept(makeContext(req, res), {
        handle: () => of({ ok: false }),
      }),
    );

    expect(service.record).toHaveBeenCalledTimes(1);
    const record = service.record.mock.calls[0][0];
    expect(record.actorId).toBeNull();
    expect(record.actorEmail).toBeNull();
    expect(record.actorRole).toBeNull();
    expect(record.statusCode).toBe(401);
  });

  it('resolves the actor from the response body when the request has no principal (login)', async () => {
    const req = {
      ...baseReq,
      method: 'POST',
      originalUrl: '/platform/auth/login',
      user: undefined,
      headers: {},
      body: { email: 'admin@payforms.com.ng', password: 'secret' },
    };
    const res = { statusCode: 201 };

    await firstValueFrom(
      interceptor.intercept(makeContext(req, res), {
        handle: () =>
          of({
            access_token: 't',
            user: {
              id: 'platform-1',
              email: 'admin@payforms.com.ng',
              role: 'SUPER',
            },
          }),
      }),
    );

    expect(service.record).toHaveBeenCalledTimes(1);
    const record = service.record.mock.calls[0][0];
    expect(record.actorId).toBe('platform-1');
    expect(record.actorEmail).toBe('admin@payforms.com.ng');
    expect(record.actorRole).toBe('SUPER');
    expect(record.statusCode).toBe(201);
  });

  it('records failures and preserves the exception status', async () => {
    const req = {
      ...baseReq,
      method: 'PATCH',
      originalUrl: '/platform/organizations/org-1/disable',
      params: { id: 'org-1' },
      query: { reason: 'policy' },
      body: { confirm: true },
    };
    const res = { statusCode: 403 };

    const error = new ForbiddenException('Organization cannot be disabled');
    await expect(
      firstValueFrom(
        interceptor.intercept(makeContext(req, res), {
          handle: () => throwError(() => error),
        }),
      ),
    ).rejects.toBe(error);

    expect(service.record).toHaveBeenCalledTimes(1);
    const record = service.record.mock.calls[0][0];
    expect(record.action).toBe('UPDATE ORGANIZATION');
    expect(record.resourceType).toBe('Organization');
    expect(record.resourceId).toBe('org-1');
    expect(record.statusCode).toBe(403);
    expect(record.metadata.error.message).toBe('Organization cannot be disabled');
    expect(record.metadata.error.status).toBe(403);
    expect(record.metadata.query.reason).toBe('policy');
  });

  it('falls back to 500 if an error has no status', async () => {
    const req = { ...baseReq, method: 'POST', originalUrl: '/platform/x' };
    const res = {};

    await expect(
      firstValueFrom(
        interceptor.intercept(makeContext(req, res), {
          handle: () => throwError(() => new Error('boom')),
        }),
      ),
    ).rejects.toThrow('boom');

    expect(service.record).toHaveBeenCalledTimes(1);
    const record = service.record.mock.calls[0][0];
    expect(record.statusCode).toBe(500);
  });

  it('derives resource type from the first path segment', async () => {
    const req = { ...baseReq, method: 'POST', originalUrl: '/platform/audit-logs' };
    const res = { statusCode: 201 };

    await firstValueFrom(
      interceptor.intercept(makeContext(req, res), {
        handle: () => of({ id: 'log-1' }),
      }),
    );

    expect(service.record).toHaveBeenCalledTimes(1);
    const record = service.record.mock.calls[0][0];
    expect(record.resourceType).toBe('AuditLog');
  });
});
