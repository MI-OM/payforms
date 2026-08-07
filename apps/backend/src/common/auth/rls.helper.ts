import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrganizationContextService } from './organization-context.service';

@Injectable()
export class RlsHelper {
  constructor(
    private readonly dataSource: DataSource,
    private readonly organizationContextService: OrganizationContextService,
  ) {}

  async withOrganizationContext<T>(
    organizationId: string,
    callback: (queryRunner: any) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(`SET app.current_org_id = '${organizationId}'`);

    try {
      return await callback(queryRunner);
    } finally {
      await queryRunner.query(`RESET app.current_org_id`);
      await queryRunner.release();
    }
  }

  async withCurrentOrganizationContext<T>(
    callback: (queryRunner: any) => Promise<T>,
  ): Promise<T> {
    const context = this.organizationContextService.getContext();
    if (!context.organizationId) {
      throw new Error(
        'Organization context not set. Ensure request is authenticated.',
      );
    }
    return this.withOrganizationContext(context.organizationId, callback);
  }

  async queryWithOrgContext<T = any>(
    sql: string,
    params: any[] = [],
  ): Promise<T> {
    return this.withCurrentOrganizationContext(async (queryRunner) => {
      return queryRunner.query(sql, params);
    });
  }

  async executeWithOrgContext(
    sql: string,
    params: any[] = [],
  ): Promise<any> {
    return this.withCurrentOrganizationContext(async (queryRunner) => {
      return queryRunner.query(sql, params);
    });
  }
}