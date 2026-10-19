import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { ContactModule } from './modules/contact/contact.module';
import { ContactAuthModule } from './modules/contact-auth/contact-auth.module';
import { GroupModule } from './modules/group/group.module';
import { FormModule } from './modules/form/form.module';
import { SubmissionModule } from './modules/submission/submission.module';
import { PaymentModule } from './modules/payment/payment.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ReportModule } from './modules/report/report.module';
import { HealthModule } from './modules/health/health.module';
import { StorageModule } from './modules/storage/storage.module';
import { TenantResolverModule } from './modules/tenant/tenant-resolver.module';
import { BillingModule } from './modules/billing/billing.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { CacheModule } from './common/cache/cache.module';
import { MarketReadinessModule } from './modules/market-readiness/market-readiness.module';
import { PlatformAuthModule } from './modules/platform-auth/platform-auth.module';
import { PlatformAuditModule } from './modules/platform-audit/platform-audit.module';
import { PlatformOrganizationsModule } from './modules/platform-organizations/platform-organizations.module';
import { PlatformNotificationsModule } from './modules/platform-notifications/platform-notifications.module';
import { PlatformSettingsModule } from './modules/platform-settings/platform-settings.module';
import { PlatformImpersonationModule } from './modules/platform-impersonation/platform-impersonation.module';
import { PlatformUsersModule } from './modules/platform-users/platform-users.module';
import { OrganizationEntitlementsModule } from './modules/organization/organization-entitlements.module';
import { PlatformEntitlementsModule } from './modules/platform-entitlements/platform-entitlements.module';
import { OrganizationContextModule } from './common/auth/organization-context.module';
import { SecurityModule } from './common/security/security.module';

@Module({
  imports: [
    CacheModule,
    SecurityModule,
    OrganizationContextModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ([{
        name: 'default',
        ttl: Number(configService.get('THROTTLE_TTL_MS', 60000)),
        limit: Number(configService.get('THROTTLE_LIMIT', 120)),
      }]),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USER', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_NAME', 'payforms'),
        // TLS note: `rejectUnauthorized: false` is required when connecting
        // through the Supabase Supavisor connection pooler, which presents a
        // certificate signed by a CA not included in Node's default trust store.
        //
        // Risk: this disables certificate-chain validation, so a MITM attack
        // on the database connection path cannot be detected by TLS alone. The
        // risk is accepted because:
        //   1. The connection travels through Supabase's own managed network.
        //   2. The Supabase pooler's hostname is validated (SNI is still used).
        //   3. Supabase does not expose a way to supply a custom CA bundle for
        //      pooled connections at the time of writing.
        //
        // Mitigation: set DB_SSL_REJECT_UNAUTHORIZED=true and supply a CA
        // bundle via DB_SSL_CA if you switch to a direct (non-pooled) Postgres
        // connection string, which Supabase supports at the cost of connection
        // count limits.
        ssl: configService.get('DB_SSL') === 'true'
          ? {
              rejectUnauthorized:
                configService.get('DB_SSL_REJECT_UNAUTHORIZED') === 'true',
              ca: configService.get<string>('DB_SSL_CA') || undefined,
            }
          : false,
        entities: [__dirname + '/modules/**/entities/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsRun: false,
        // TypeORM schema synchronization is dangerous in non-development
        // environments: it auto-alters tables to match entity definitions and
        // can silently drop columns. It is strictly limited to NODE_ENV=development
        // and is always disabled in production. Never set NODE_ENV=development
        // on a database with real customer data.
        synchronize: process.env.NODE_ENV === 'development',
        extra: {
          max: Number(configService.get('DB_POOL_MAX', 50)),
          min: Number(configService.get('DB_POOL_MIN', 5)),
          idleTimeoutMillis: Number(configService.get('DB_POOL_IDLE_TIMEOUT_MS', 30000)),
          connectionTimeoutMillis: Number(configService.get('DB_POOL_CONNECTION_TIMEOUT_MS', 5000)),
        },
        logging: process.env.NODE_ENV === 'development',
      }),
    }),
    AuthModule,
    OrganizationModule,
    ContactModule,
    ContactAuthModule,
    GroupModule,
    FormModule,
    SubmissionModule,
    PaymentModule,
    AuditModule,
    NotificationModule,
    StorageModule,
    ReportModule,
    HealthModule,
    TenantResolverModule,
    BillingModule,
    ComplianceModule,
    MarketReadinessModule,
    PlatformAuthModule,
    PlatformAuditModule,
    PlatformOrganizationsModule,
    PlatformNotificationsModule,
    PlatformSettingsModule,
    PlatformImpersonationModule,
    PlatformUsersModule,
    OrganizationEntitlementsModule,
    PlatformEntitlementsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
