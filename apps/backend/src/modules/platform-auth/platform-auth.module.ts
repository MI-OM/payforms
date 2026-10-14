import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformUser } from './entities/platform-user.entity';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformJwtStrategy } from './strategies/platform-jwt.strategy';
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from './guards/platform-roles.guard';
import { resolvePlatformJwtSecret } from './platform-jwt.config';

/**
 * Platform admin identity module (Part 3, Wave A, Module 1).
 *
 * `JwtModule` is registered here with its own secret. `JwtModule` is not
 * global, so this instance is scoped to this module and cannot affect the
 * tenant `AuthModule`/`ContactAuthModule` JWT configuration.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformUser]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: resolvePlatformJwtSecret(configService),
      }),
    }),
  ],
  controllers: [PlatformAuthController],
  providers: [
    PlatformAuthService,
    PlatformJwtStrategy,
    PlatformJwtAuthGuard,
    PlatformRolesGuard,
  ],
  exports: [PlatformAuthService],
})
export class PlatformAuthModule {}
