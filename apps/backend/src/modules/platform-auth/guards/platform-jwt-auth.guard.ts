import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guards platform-admin endpoints. Backed by the `platform-jwt` passport
 * strategy (separate secret + cookie from tenant auth), so tenant tokens are
 * never accepted here.
 */
@Injectable()
export class PlatformJwtAuthGuard extends AuthGuard('platform-jwt') {}
