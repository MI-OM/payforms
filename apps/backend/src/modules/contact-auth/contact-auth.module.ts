import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Contact } from '../contact/entities/contact.entity';
import { Organization } from '../organization/entities/organization.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';
import { ContactAuthService } from './contact-auth.service';
import { ContactAuthHardeningService } from './services/contact-auth-hardening.service';
import { ContactAuthController } from './contact-auth.controller';
import { ContactJwtStrategy } from './strategies/contact-jwt.strategy';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, Organization, ActivityLog]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('CONTACT_ACCESS_TOKEN_TTL', '8h'),
        },
      }),
    }),
    NotificationModule,
    PaymentModule,
  ],
  controllers: [ContactAuthController],
  providers: [ContactAuthService, ContactAuthHardeningService, ContactJwtStrategy],
  exports: [ContactAuthService, ContactAuthHardeningService, JwtModule],
})
export class ContactAuthModule {}
