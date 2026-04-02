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
    const action = `${req.method} ${req.originalUrl || req.url}`;
    const entityType = req.route?.path || req.path || 'request';
    const entityId = req.params?.id || req.params?.payment_id || req.params?.user_id || '';
    const metadata = {
      ip_address: ipAddress,
      user_agent: userAgent,
      params: req.params,
      query: req.query,
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
}
