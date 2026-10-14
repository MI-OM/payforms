import { RlsQueryRunnerPatcher } from './rls-query-runner.patcher';

describe('RlsQueryRunnerPatcher', () => {
  const baseQuery = jest.fn();
  const createQueryRunner = jest.fn();
  const contextService = {
    getRlsSettings: jest.fn(),
  };

  let queryRunner: any;
  let dataSource: any;
  let patcher: RlsQueryRunnerPatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    baseQuery.mockResolvedValue({ rows: [] });
    queryRunner = { query: baseQuery, release: jest.fn() };
    createQueryRunner.mockReturnValue(queryRunner);
    dataSource = { createQueryRunner };
    patcher = new RlsQueryRunnerPatcher(dataSource as any, contextService as any);
    patcher.onModuleInit();
  });

  afterEach(() => {
    patcher.onModuleDestroy();
  });

  it('applies the tenant organization on the connection before the query', async () => {
    contextService.getRlsSettings.mockReturnValue({
      organizationId: 'org-1',
      bypass: false,
    });

    const wrapped = dataSource.createQueryRunner();
    await wrapped.query('SELECT 1', [], false);

    expect(baseQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("set_config('app.current_org_id'"),
      ['org-1', ''],
    );
    expect(baseQuery).toHaveBeenNthCalledWith(2, 'SELECT 1', [], false);
  });

  it('applies the system bypass when there is no tenant context', async () => {
    contextService.getRlsSettings.mockReturnValue({ organizationId: '', bypass: true });

    const wrapped = dataSource.createQueryRunner();
    await wrapped.query('SELECT 2');

    expect(baseQuery).toHaveBeenNthCalledWith(1, expect.any(String), ['', 'on']);
    expect(baseQuery).toHaveBeenNthCalledWith(2, 'SELECT 2', undefined, undefined);
  });

  it('reapplies the context for a fresh connection taken from the pool', async () => {
    contextService.getRlsSettings.mockReturnValueOnce({
      organizationId: 'org-1',
      bypass: false,
    });
    const first = dataSource.createQueryRunner();
    await first.query('SELECT 3');

    const secondBaseQuery = jest.fn().mockResolvedValue({ rows: [] });
    const secondRunner = { query: secondBaseQuery };
    createQueryRunner.mockReturnValueOnce(secondRunner);
    contextService.getRlsSettings.mockReturnValueOnce({
      organizationId: '',
      bypass: true,
    });

    const second = dataSource.createQueryRunner();
    await second.query('SELECT 4');

    expect(secondBaseQuery).toHaveBeenNthCalledWith(1, expect.any(String), ['', 'on']);
    expect(secondBaseQuery).toHaveBeenNthCalledWith(2, 'SELECT 4', undefined, undefined);
  });

  it('does not reapply an unchanged context on the same runner', async () => {
    contextService.getRlsSettings.mockReturnValue({
      organizationId: 'org-1',
      bypass: false,
    });

    const wrapped = dataSource.createQueryRunner();
    await wrapped.query('SELECT 5');
    await wrapped.query('SELECT 6');

    // one context statement + two actual queries
    expect(baseQuery).toHaveBeenCalledTimes(3);
  });

  it('restores the original createQueryRunner on destroy', () => {
    expect(dataSource.createQueryRunner).not.toBe(createQueryRunner);
    patcher.onModuleDestroy();
    expect(dataSource.createQueryRunner).toBe(createQueryRunner);
  });
});
