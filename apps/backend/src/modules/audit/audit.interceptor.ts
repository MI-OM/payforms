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
    const actor = this.resolveAuditActor(user);

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
    const baseMetadata = {
      raw_path: req.originalUrl || req.url,
      params: req.params,
      query: req.query,
      ip_address: ipAddress,
      user_agent: userAgent,
      entity: this.buildEntityMetadata(routePath, req.params, req.query),
      actor: user
        ? {
            id: actor.userId ?? actor.contactId,
            email: user.email ?? null,
            role: user.role ?? null,
            first_name: user.first_name ?? null,
            middle_name: user.middle_name ?? null,
            last_name: user.last_name ?? null,
          }
        : null,
    };

    return next.handle().pipe(
      tap(responseBody => {
        const metadata = this.enrichEntityMetadata(baseMetadata, routePath, responseBody);
        this.auditService.createActivityLog(
          organizationId,
          actor.userId,
          actor.contactId,
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
      'GET /contacts/:id/details': 'VIEW CONTACT DETAILS',
      'GET /transactions': 'VIEW TRANSACTIONS',
      'GET /transactions/:id': 'VIEW TRANSACTION DETAILS',
      'GET /transactions/:id/history': 'VIEW TRANSACTION HISTORY',
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

  private resolveAuditActor(user: any): { userId: string | null; contactId: string | null } {
    if (!user) {
      return { userId: null, contactId: null };
    }

    if (String(user.role || '').toUpperCase() === 'CONTACT') {
      return {
        userId: null,
        contactId: user.id ?? user.sub ?? null,
      };
    }

    return {
      userId: user.id ?? user.sub ?? null,
      contactId: null,
    };
  }

  private buildEntityMetadata(path: string, params: Record<string, any> = {}, query: Record<string, any> = {}) {
    const cleaned = this.cleanRoutePath(path);

    if (cleaned === '/contacts/:param/details' || cleaned === '/contacts/:param') {
      return {
        type: 'Contact',
        id: params.id || null,
        label: params.id ? `Contact ${params.id}` : 'Contact',
      };
    }

    if (cleaned === '/transactions') {
      const parts = [
        query.reference ? `reference=${query.reference}` : null,
        query.contact_id ? `contact=${query.contact_id}` : null,
        query.form_id ? `form=${query.form_id}` : null,
        query.status ? `status=${query.status}` : null,
      ].filter(Boolean);

      return {
        type: 'Transaction',
        id: null,
        label: parts.length ? `Transactions (${parts.join(', ')})` : 'Transactions',
      };
    }

    if (cleaned === '/transactions/:param' || cleaned === '/transactions/:param/history') {
      const transactionId = params.id || params.payment_id || null;
      return {
        type: 'Transaction',
        id: transactionId,
        label: transactionId ? `Transaction ${transactionId}` : 'Transaction',
      };
    }

    return {
      type: this.buildEntityType(path),
      id: params.id || params.payment_id || params.user_id || null,
      label: null,
    };
  }

  private enrichEntityMetadata(baseMetadata: Record<string, any>, path: string, responseBody: any) {
    const entity = { ...(baseMetadata.entity || {}) };
    const cleaned = this.cleanRoutePath(path);

    if ((cleaned === '/contacts/:param/details' || cleaned === '/contacts/:param') && responseBody) {
      const firstName = responseBody.first_name ?? null;
      const middleName = responseBody.middle_name ?? null;
      const lastName = responseBody.last_name ?? null;
      const email = responseBody.email ?? null;
      const name = [firstName, middleName, lastName].filter(Boolean).join(' ').trim() || email || entity.id || 'Contact';
      entity.id = responseBody.id ?? entity.id ?? null;
      entity.label = name;
      entity.name = name;
      entity.email = email;
    }

    if ((cleaned === '/transactions/:param' || cleaned === '/transactions/:param/history') && responseBody) {
      const source = responseBody.payment ?? responseBody;
      const reference = source?.reference ?? source?.payment_reference ?? null;
      const customerName = source?.customer_name ?? null;
      entity.id = source?.id ?? entity.id ?? null;
      entity.label = reference ? `Payment ${reference}` : entity.label || entity.id || 'Transaction';
      if (customerName) {
        entity.subject = customerName;
      }
      if (reference) {
        entity.reference = reference;
      }
    }

    return {
      ...baseMetadata,
      entity,
    };
  }
}
