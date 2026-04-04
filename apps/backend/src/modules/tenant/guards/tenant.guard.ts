import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { TenantResolverService } from '../tenant-resolver.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private tenantResolverService: TenantResolverService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const host = request.get('host') || '';
    const organizationId = request.headers['x-organization-id'] as string;

    // Resolve organization from host
    const resolved = await this.tenantResolverService.resolveOrganizationFromHost(
      host,
      organizationId,
    );

    if (!resolved) {
      throw new BadRequestException('Unable to resolve organization context');
    }

    // If both host resolution and explicit org_id provided, verify they match
    if (organizationId && organizationId !== resolved.organization_id) {
      throw new BadRequestException('Organization context mismatch with provided organization_id');
    }

    // Attach resolved organization to request for downstream use
    request['organization_id'] = resolved.organization_id;
    request['organization'] = resolved.organization;

    return true;
  }
}
