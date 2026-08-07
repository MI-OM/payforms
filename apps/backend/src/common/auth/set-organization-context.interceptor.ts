import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { OrganizationContextService } from './organization-context.service';

@Injectable()
export class SetOrganizationContextInterceptor implements NestInterceptor {
  constructor(
    private readonly organizationContextService: OrganizationContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (user?.organization_id) {
      this.organizationContextService.setOrganizationContext(
        user.organization_id,
        user.id,
      );
    }

    return next.handle();
  }
}