import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLATFORM_ROLES_KEY } from '../decorators/platform-roles.decorator';

/**
 * Role gate for platform admins. Mirrors `RolesGuard`, but reads the platform
 * roles key and requires the `is_platform_admin` marker set by the
 * `platform-jwt` strategy so a tenant user object could never satisfy it.
 *
 * With a single `SUPER` role today this is mostly a no-op, but it lets future
 * modules declare `@PlatformRoles('BILLING')` etc. without any new plumbing.
 */
@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      PLATFORM_ROLES_KEY,
      context.getHandler(),
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    return (
      !!user &&
      user.is_platform_admin === true &&
      requiredRoles.includes(user.role)
    );
  }
}
