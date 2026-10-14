import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { OrganizationContextService } from './organization-context.service';
import { SetOrganizationContextInterceptor } from './set-organization-context.interceptor';
import { RlsHelper } from './rls.helper';
import { RlsQueryRunnerPatcher } from './rls-query-runner.patcher';

@Global()
@Module({
  providers: [
    OrganizationContextService,
    {
      provide: APP_INTERCEPTOR,
      useClass: SetOrganizationContextInterceptor,
    },
    RlsHelper,
    RlsQueryRunnerPatcher,
  ],
  exports: [OrganizationContextService, RlsHelper],
})
export class OrganizationContextModule {}