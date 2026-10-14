import { BadRequestException } from '@nestjs/common';
import { RlsHelper } from './rls.helper';

describe('RlsHelper', () => {
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    query: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };
  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  };
  const organizationContextService = {
    getContext: jest.fn(),
  };

  const UUID = '11111111-1111-1111-1111-111111111111';
  let helper: RlsHelper;

  beforeEach(() => {
    jest.clearAllMocks();
    helper = new RlsHelper(dataSource as any, organizationContextService as any);
  });

  it('sets the organization context with a bound parameter inside a transaction', async () => {
    const callback = jest.fn().mockResolvedValue('ok');

    const result = await helper.withOrganizationContext(UUID, callback);

    expect(queryRunner.startTransaction).toHaveBeenCalled();
    expect(queryRunner.query).toHaveBeenCalledWith('SELECT set_config($1, $2, true)', [
      'app.current_org_id',
      UUID,
    ]);
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
    expect(result).toBe('ok');
  });

  it('rejects a non-UUID organization id without touching the database', async () => {
    await expect(
      helper.withOrganizationContext("x'; DROP TABLE users; --", jest.fn()),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('rolls back the transaction when the callback throws', async () => {
    const callback = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(helper.withOrganizationContext(UUID, callback)).rejects.toThrow('boom');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });
});
