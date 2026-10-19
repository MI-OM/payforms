import { Global, Module } from '@nestjs/common';
import { PaystackKeyEncryptionService } from './paystack-key-encryption.service';

/**
 * Global security utilities module.
 *
 * Registered as `@Global()` so `PaystackKeyEncryptionService` can be injected
 * anywhere without explicit imports in every feature module.
 */
@Global()
@Module({
  providers: [PaystackKeyEncryptionService],
  exports: [PaystackKeyEncryptionService],
})
export class SecurityModule {}
