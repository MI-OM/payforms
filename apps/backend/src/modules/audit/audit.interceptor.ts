import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './services/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const organizationId = user?.organization_id;
    const userId = user?.id ?? null;

    if (!organizationId) {
      return next.handle();
    }

    const ipAddress =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      null;
    const userAgent = req.headers['user-agent'] || null;
    const routePath = req.route?.path || req.path || req.url || '';
    const action = this.buildAuditAction(req.method, routePath);
    const entityType = this.buildEntityType(routePath);
    const entityId = req.params?.id || req.params?.payment_id || req.params?.user_id || '';
    const metadata = {
      raw_path: req.originalUrl || req.url,
      params: req.params,
      query: req.query,
      ip_address: ipAddress,
      user_agent: userAgent,
    };

    return next.handle().pipe(
      tap(() => {
        this.auditService.createActivityLog(
          organizationId,
          userId,
          action,
          entityType,
          entityId,
          metadata,
          ipAddress,
          userAgent,
        );
      }),
    );
  }

  private buildAuditAction(method: string, path: string): string {
    const key = this.buildRouteKey(method, path);
    const overrides: Record<string, string> = {
      'POST /auth/login': 'AUTHENTICATE USER',
      'POST /auth/register': 'REGISTER ORGANIZATION',
      'POST /auth/password-reset/request': 'REQUEST PASSWORD RESET',
      'POST /auth/password-reset/confirm': 'CONFIRM PASSWORD RESET',
      'GET /auth/me': 'VIEW PROFILE',
      'GET /auth/profile': 'VIEW PROFILE',
      'PATCH /auth/profile': 'UPDATE PROFILE',
      'POST /auth/invite': 'INVITE USER',
      'POST /auth/organization-email/request-verification': 'REQUEST ORGANIZATION EMAIL VERIFICATION',
      'POST /organization/logo': 'UPLOAD ORGANIZATION LOGO',
      'PATCH /organization/keys': 'UPDATE ORGANIZATION KEYS',
      'GET /organization/settings': 'VIEW ORGANIZATION SETTINGS',
      'PATCH /organization/settings': 'UPDATE ORGANIZATION SETTINGS',
      'POST /public/forms/:slug/submit': 'SUBMIT PUBLIC FORM',
      'GET /public/payments/callback': 'VIEW PAYMENT CALLBACK',
      'GET /public/forms/:slug': 'VIEW PUBLIC FORM',
      'GET /health': 'CHECK SYSTEM HEALTH',
    };

    if (overrides[key]) {
      return overrides[key];
    }

    const verb = this.mapHttpMethodToVerb(method);
    const cleaned = this.cleanRoutePath(path);
    const segments = cleaned
      .split('/')
      .filter(segment => segment && !segment.startsWith(':') && !this.isRouteParam(segment));

    if (segments.length === 0) {
      return verb;
    }

    const labels = segments.map(segment => segment.replace(/[-_]/g, ' '));
    return `${verb} ${labels.join(' ').toUpperCase()}`;
  }

  private buildEntityType(path: string): string {
    const key = this.cleanRoutePath(path);
    const segments = key
      .split('/')
      .filter(segment => segment && !segment.startsWith(':') && !this.isRouteParam(segment));

    if (segments.length === 0) {
      return 'Request';
    }

    const overrides: Record<string, string> = {
      audit: 'AuditLog',
      'payment-logs': 'PaymentLog',
      payments: 'Payment',
      reports: 'Report',
      organization: 'Organization',
      contacts: 'Contact',
      forms: 'Form',
      groups: 'Group',
      notifications: 'Notification',
      submissions: 'Submission',
      auth: 'Authentication',
      'contact-auth': 'ContactAuthentication',
      users: 'User',
      public: 'PublicResource',
      webhooks: 'Webhook',
    };

    if (segments[0] === 'public' && segments[1] === 'forms') {
      return 'PublicForm';
    }
    if (segments[0] === 'public' && segments[1] === 'payments') {
      return 'PublicPayment';
    }

    for (const segment of segments) {
      if (overrides[segment]) {
        return overrides[segment];
      }
    }

    const last = segments[segments.length - 1];
    const singular = last.replace(/s$/, '');
    return singular.charAt(0).toUpperCase() + singular.slice(1);
  }

  private buildRouteKey(method: string, path: string): string {
    const cleaned = this.cleanRoutePath(path);
    return `${method?.toUpperCase() || 'GET'} ${cleaned}`.replace(/\/+/g, '/').replace(/\/+$/, '');
  }

  private cleanRoutePath(path: string): string {
    return path
      .split('?')[0]
      .replace(/:\w+/g, ':param')
      .replace(/\/+/g, '/')
      .trim();
  }

  private isRouteParam(segment: string): boolean {
    return segment.startsWith(':') || /^[0-9a-fA-F-]{8,}$/.test(segment);
  }

  private mapHttpMethodToVerb(method: string): string {
    switch (method?.toUpperCase()) {
      case 'POST':
        return 'CREATE';
      case 'PUT':
      case 'PATCH':
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      case 'GET':
      default:
        return 'VIEW';
    }
  }
}
