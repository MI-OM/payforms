import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformImpersonationService } from './platform-impersonation.service';
import {
  ListImpersonationSessionsQueryDto,
  StartImpersonationDto,
} from './dto/platform-impersonation.dto';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';
import { PlatformRoles } from '../platform-auth/decorators/platform-roles.decorator';
import { PlatformAuditInterceptor } from '../platform-audit/platform-audit.interceptor';
import { PlatformAuditAction } from '../platform-audit/decorators/platform-audit.decorator';

/**
 * Platform impersonation console (Part 3, Wave B item 9 — IN v1).
 *
 * Starting a session returns a short-lived TENANT access token. The console
 * stores that token separately and shows the returned banner while it is in
 * use. Ending a session revokes the token immediately. Every start/end is
 * audited; reads are not.
 */
@ApiTags('Platform Admin')
@Controller('platform')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
@PlatformRoles('SUPER')
@UseInterceptors(PlatformAuditInterceptor)
export class PlatformImpersonationController {
  constructor(
    private readonly platformImpersonationService: PlatformImpersonationService,
  ) {}

  @Post('organizations/:id/impersonate')
  @PlatformAuditAction('START IMPERSONATION', 'ImpersonationSession')
  async start(
    @Param('id') organizationId: string,
    @Body() dto: StartImpersonationDto,
    @Request() req: any,
  ) {
    return this.platformImpersonationService.start(organizationId, dto, req.user, {
      ipAddress:
        req.headers?.['x-forwarded-for']?.toString().split(',')[0].trim() ||
        req.ip ||
        req.connection?.remoteAddress ||
        null,
      userAgent: (req.headers?.['user-agent'] as string) || null,
    });
  }

  @Post('impersonation-sessions/:id/end')
  @HttpCode(200)
  @PlatformAuditAction('END IMPERSONATION', 'ImpersonationSession')
  async end(@Param('id') sessionId: string, @Request() req: any) {
    return this.platformImpersonationService.end(sessionId, req.user);
  }

  @Get('impersonation-sessions')
  async list(@Query() query: ListImpersonationSessionsQueryDto) {
    return this.platformImpersonationService.list(query);
  }

  @Get('impersonation-sessions/:id')
  async detail(@Param('id') sessionId: string) {
    return this.platformImpersonationService.detail(sessionId);
  }
}
