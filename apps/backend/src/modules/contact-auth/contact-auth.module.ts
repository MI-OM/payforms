import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Contact } from '../contact/entities/contact.entity';
import { Organization } from '../organization/entities/organization.entity';
import { ContactAuthService } from './contact-auth.service';
import { ContactAuthController } from './contact-auth.controller';
import { ContactJwtStrategy } from './strategies/contact-jwt.strategy';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, Organization]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    NotificationModule,
    PaymentModule,
  ],
  controllers: [ContactAuthController],
  providers: [ContactAuthService, ContactJwtStrategy],
  exports: [ContactAuthService, JwtModule],
})
export class ContactAuthModule {}
