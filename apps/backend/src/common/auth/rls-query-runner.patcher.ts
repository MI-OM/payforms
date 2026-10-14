import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { OrganizationContextService } from './organization-context.service';

/**
 * Sets both RLS GUCs on the connection before every statement.
 *
 * `set_config(name, value, false)` is session scoped, which is safe because a
 * TypeORM QueryRunner holds a single pooled connection for its whole lifetime,
 * and every query issued through it reapplies the current context first. That
 * also guarantees a pooled connection reused by another request can never leak
 * the previous request's organization.
 */
const RLS_CONTEXT_SQL =
  "SELECT set_config('app.current_org_id', $1, false) AS org, set_config('app.rls_bypass', $2, false) AS bypass";

type RlsSettings = { organizationId: string; bypass: boolean };

interface RlsAwareQueryRunner extends QueryRunner {
  __rlsWrapped?: boolean;
  __rlsSettings?: RlsSettings | null;
}

@Injectable()
export class RlsQueryRunnerPatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RlsQueryRunnerPatcher.name);
  private originalCreateQueryRunner: DataSource['createQueryRunner'] | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly organizationContextService: OrganizationContextService,
  ) {}

  onModuleInit(): void {
    if (this.originalCreateQueryRunner) {
      return;
    }

    const dataSource = this.dataSource;
    this.originalCreateQueryRunner = dataSource.createQueryRunner;

    dataSource.createQueryRunner = ((mode?: any) => {
      const queryRunner = this.originalCreateQueryRunner!.call(dataSource, mode);
      return this.wrapQueryRunner(queryRunner);
    }) as typeof dataSource.createQueryRunner;

    this.logger.log('Row Level Security context propagation enabled');
  }

  onModuleDestroy(): void {
    if (this.originalCreateQueryRunner) {
      this.dataSource.createQueryRunner = this.originalCreateQueryRunner;
      this.originalCreateQueryRunner = null;
    }
  }

  private wrapQueryRunner(queryRunner: QueryRunner): QueryRunner {
    const rlsQueryRunner = queryRunner as RlsAwareQueryRunner;
    if (rlsQueryRunner.__rlsWrapped) {
      return queryRunner;
    }

    const originalQuery = queryRunner.query.bind(queryRunner);
    rlsQueryRunner.__rlsWrapped = true;
    rlsQueryRunner.__rlsSettings = null;

    queryRunner.query = (async (
      query: string,
      parameters?: any[],
      useStructuredResult?: boolean,
    ) => {
      const settings = this.organizationContextService.getRlsSettings();
      const applied = rlsQueryRunner.__rlsSettings;

      if (
        !applied ||
        applied.organizationId !== settings.organizationId ||
        applied.bypass !== settings.bypass
      ) {
        await originalQuery(RLS_CONTEXT_SQL, [
          settings.organizationId,
          settings.bypass ? 'on' : '',
        ]);
        rlsQueryRunner.__rlsSettings = settings;
      }

      return originalQuery(query, parameters, useStructuredResult as any);
    }) as QueryRunner['query'];

    return queryRunner;
  }
}
