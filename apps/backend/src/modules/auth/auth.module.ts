import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { Invitation } from './entities/invitation.entity';
import { Organization } from '../organization/entities/organization.entity';
import { ImpersonationSession } from '../platform-impersonation/entities/impersonation-session.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { NotificationModule } from '../notification/notification.module';
import { TenantResolverModule } from '../tenant/tenant-resolver.module';
import { OrganizationStatusModule } from '../organization/organization-status.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Invitation, Organization, ImpersonationSession]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('AUTH_ACCESS_TOKEN_TTL', '15m'),
        },
      }),
    }),
    NotificationModule,
    TenantResolverModule,
    OrganizationStatusModule,
    // Enforces the plan's `staff_users` hard limit on invite/accept.
    BillingModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
  exports: [AuthService],
})
export class AuthModule {}
