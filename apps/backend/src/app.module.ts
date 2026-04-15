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

@Module({
  imports: [
    CacheModule,
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
        entities: [__dirname + '/modules/**/entities/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsRun: false,
        synchronize: process.env.NODE_ENV !== 'production',
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
