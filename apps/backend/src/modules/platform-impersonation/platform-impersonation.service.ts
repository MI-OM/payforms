import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { User } from '../auth/entities/user.entity';
import { PlatformFeatureFlagsService } from '../platform-settings/platform-feature-flags.service';
import { ImpersonationSession } from './entities/impersonation-session.entity';
import { NotificationService } from '../notification/notification.service';
import {
  IMPERSONATION_DEFAULT_DURATION_MINUTES,
  IMPERSONATION_DISABLED_MESSAGE,
  IMPERSONATION_FEATURE_FLAG_KEY,
  IMPERSONATION_MAX_DURATION_MINUTES,
  IMPERSONATION_MIN_DURATION_MINUTES,
} from './platform-impersonation.constants';
import {
  ListImpersonationSessionsQueryDto,
  StartImpersonationDto,
} from './dto/platform-impersonation.dto';

export interface PlatformActor {
  id?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface ImpersonationRequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Platform impersonation (Part 3, Wave B item 9 — IN v1).
 *
 * `start` performs three things atomically-enough for support use:
 *   1. verifies the feature flag allows impersonation for the organization,
 *   2. records a durable `impersonation_sessions` row (with a mandatory reason),
 *   3. mints a TENANT access token signed with the tenant `JWT_SECRET` whose
 *      payload carries `impersonation.session_id`.
 *
 * The tenant `JwtStrategy` picks that claim up and validates the session on
 * every request, so ending (or expiring) a session revokes the token at once.
 * No refresh token is ever issued for an impersonation session.
 */
@Injectable()
export class PlatformImpersonationService {
  private readonly logger = new Logger(PlatformImpersonationService.name);

  constructor(
    @InjectRepository(ImpersonationSession)
    private readonly sessionRepository: Repository<ImpersonationSession>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly featureFlagsService: PlatformFeatureFlagsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {}

  async start(
    organizationId: string,
    dto: StartImpersonationDto,
    actor: PlatformActor,
    context: ImpersonationRequestContext = {},
  ) {
    // The route is guarded, so the platform operator is always present; assert it
    // to keep the audit columns (which are NOT NULL) honest.
    if (!actor?.id || !actor?.email) {
      throw new UnauthorizedException('Platform operator identity is required');
    }

    await this.assertImpersonationAllowed(organizationId);

    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const targetUser = await this.resolveTargetUser(organizationId, dto.user_id);

    const durationMinutes = this.resolveDuration(dto.duration_minutes);
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const session = await this.sessionRepository.save(
      this.sessionRepository.create({
        platform_user_id: actor.id,
        platform_user_email: actor.email,
        organization_id: organization.id,
        target_user_id: targetUser.id,
        target_user_email: targetUser.email,
        reason: dto.reason.trim(),
        status: 'active',
        expires_at: expiresAt,
        ended_at: null,
        ended_by_platform_user_id: null,
        ended_by_email: null,
        metadata: {
          duration_minutes: durationMinutes,
          ip_address: context.ipAddress ?? null,
          user_agent: context.userAgent ?? null,
        },
      }),
    );

    const accessToken = this.jwtService.sign(
      {
        sub: targetUser.id,
        email: targetUser.email,
        organization_id: targetUser.organization_id,
        role: targetUser.role,
        first_name: targetUser.first_name,
        middle_name: targetUser.middle_name,
        last_name: targetUser.last_name,
        title: targetUser.title,
        designation: targetUser.designation,
        impersonation: {
          session_id: session.id,
          platform_user_id: actor.id,
          platform_user_email: actor.email,
        },
      },
      { expiresIn: `${durationMinutes}m` },
    );

    // Notify the school admin that a support session has been started.
    // This is a best-effort security alert — a failure must never block the
    // impersonation flow itself, since the session is already fully audited.
    void this.sendImpersonationNotice(organization, session, actor);

    return {
      session: this.toView(session),
      access_token: accessToken,
      token_type: 'Bearer',
      expires_at: session.expires_at,
      organization: {
        id: organization.id,
        name: organization.name,
        status: organization.status,
      },
      user: this.mapUser(targetUser),
      banner: {
        impersonation: true,
        session_id: session.id,
        reason: session.reason,
        platform_user_email: actor?.email ?? null,
        expires_at: session.expires_at,
      },
    };
  }

  async end(sessionId: string, actor: PlatformActor) {
    const session = await this.requireSession(sessionId);
    if (session.status !== 'active') {
      throw new BadRequestException('Impersonation session is no longer active');
    }

    session.status = 'ended';
    session.ended_at = new Date();
    session.ended_by_platform_user_id = actor?.id ?? null;
    session.ended_by_email = actor?.email ?? null;

    const saved = await this.sessionRepository.save(session);
    return { session: this.toView(saved) };
  }

  async list(query: ListImpersonationSessionsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    const qb = this.sessionRepository.createQueryBuilder('session');

    if (query.status) {
      qb.andWhere('session.status = :status', { status: query.status });
    }
    if (query.organization_id) {
      qb.andWhere('session.organization_id = :organizationId', {
        organizationId: query.organization_id,
      });
    }
    if (query.platform_user_id) {
      qb.andWhere('session.platform_user_id = :platformUserId', {
        platformUserId: query.platform_user_id,
      });
    }
    if (query.from) {
      qb.andWhere('session.created_at >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('session.created_at <= :to', { to: new Date(query.to) });
    }

    qb.orderBy('session.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((row) => this.toView(row)),
      total,
      page,
      limit,
    };
  }

  async detail(sessionId: string) {
    const session = await this.requireSession(sessionId);
    return { session: this.toView(session) };
  }

  // --- internals ------------------------------------------------------------

  /**
   * Best-effort email alert to the school admin when a platform support session
   * begins. Failures are logged but never propagate — the session is already
   * recorded in the audit trail regardless.
   */
  private async sendImpersonationNotice(
    organization: Organization,
    session: ImpersonationSession,
    actor: PlatformActor,
  ): Promise<void> {
    if (!organization.email) {
      return;
    }

    const expiresStr = session.expires_at.toUTCString();
    const subject = `Security notice: Payforms support access for ${organization.name}`;
    const html = `
      <p>Hello,</p>
      <p>
        A Payforms support representative (<strong>${actor.email ?? 'unknown'}</strong>)
        has started a temporary support session for your organization
        <strong>${organization.name}</strong>.
      </p>
      <ul>
        <li><strong>Reason recorded:</strong> ${session.reason}</li>
        <li><strong>Session expires:</strong> ${expiresStr}</li>
        <li><strong>Session ID:</strong> ${session.id}</li>
      </ul>
      <p>
        This session is fully logged and attributable. If you did not request support
        or have concerns about this access, please contact us immediately by replying
        to this email.
      </p>
      <p>
        To disable support access for your organization permanently, go to
        <strong>Settings → Security → Support Access</strong> in your Payforms dashboard.
      </p>
    `;

    try {
      await this.notificationService.sendEmail(
        [organization.email],
        subject,
        html,
        undefined,
        { organizationId: organization.id, enforceQuota: false },
      );
    } catch (err: any) {
      this.logger.warn(
        `Impersonation notice email failed for org ${organization.id}: ${err?.message ?? String(err)}`,
      );
    }
  }

  /**
   * Kill switch. The flag is opt-OUT: while the flag row does not exist the
   * feature is considered enabled (the "impersonation is IN v1" decision);
   * creating the flag with `enabled: false` disables it globally, and a
   * per-organization override disables it for a single tenant.
   */
  private async assertImpersonationAllowed(organizationId: string): Promise<void> {
    const gate = await this.featureFlagsService.resolve(
      IMPERSONATION_FEATURE_FLAG_KEY,
      organizationId,
    );
    const allowed = gate.source === 'missing' ? true : gate.enabled;
    if (!allowed) {
      throw new ForbiddenException(IMPERSONATION_DISABLED_MESSAGE);
    }
  }

  private async resolveTargetUser(
    organizationId: string,
    requestedUserId?: string,
  ): Promise<User> {
    if (requestedUserId) {
      const user = await this.userRepository.findOne({
        where: { id: requestedUserId, organization_id: organizationId },
      });
      if (!user) {
        throw new NotFoundException('User not found in this organization');
      }
      return user;
    }

    const admin = await this.userRepository.findOne({
      where: { organization_id: organizationId, role: 'ADMIN', is_active: true },
      order: { created_at: 'ASC' },
    });
    if (!admin) {
      throw new BadRequestException(
        'Organization has no active admin user to impersonate; specify user_id explicitly',
      );
    }
    return admin;
  }

  private resolveDuration(requested?: number): number {
    if (!requested) {
      return IMPERSONATION_DEFAULT_DURATION_MINUTES;
    }
    return Math.min(
      Math.max(Math.round(requested), IMPERSONATION_MIN_DURATION_MINUTES),
      IMPERSONATION_MAX_DURATION_MINUTES,
    );
  }

  private async requireSession(sessionId: string): Promise<ImpersonationSession> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Impersonation session not found');
    }
    return session;
  }

  private mapUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      organization_id: user.organization_id,
      role: user.role,
      first_name: user.first_name,
      middle_name: user.middle_name,
      last_name: user.last_name,
      title: user.title,
      designation: user.designation,
    };
  }

  private toView(session: ImpersonationSession) {
    return {
      id: session.id,
      status: session.status,
      reason: session.reason,
      platform_user_id: session.platform_user_id,
      platform_user_email: session.platform_user_email,
      organization_id: session.organization_id,
      target_user_id: session.target_user_id,
      target_user_email: session.target_user_email,
      expires_at: session.expires_at,
      ended_at: session.ended_at ?? null,
      ended_by_platform_user_id: session.ended_by_platform_user_id ?? null,
      ended_by_email: session.ended_by_email ?? null,
      metadata: session.metadata ?? null,
      created_at: session.created_at,
    };
  }
}
