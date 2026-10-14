import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrganizationContextService } from './organization-context.service';

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

@Injectable()
export class RlsHelper {
  constructor(
    private readonly dataSource: DataSource,
    private readonly organizationContextService: OrganizationContextService,
  ) {}

  private assertValidOrganizationId(organizationId: string): void {
    if (typeof organizationId !== 'string' || !UUID_PATTERN.test(organizationId)) {
      throw new BadRequestException('Invalid organization context');
    }
  }

  async withOrganizationContext<T>(
    organizationId: string,
    callback: (queryRunner: any) => Promise<T>,
  ): Promise<T> {
    this.assertValidOrganizationId(organizationId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // set_config(..., true) scopes the setting to the current transaction and
      // the value is passed as a bound parameter, so it cannot break out of the
      // statement (previously this was an interpolated SET, allowing SQL injection).
      await queryRunner.query('SELECT set_config($1, $2, true)', [
        'app.current_org_id',
        organizationId,
      ]);

      const result = await callback(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
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
