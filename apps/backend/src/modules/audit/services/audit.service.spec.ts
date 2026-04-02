import { AuditService } from './audit.service';
import { ActivityLog } from '../entities/activity-log.entity';
import { PaymentLog } from '../entities/payment-log.entity';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

type MockRepository = Record<string, any>;

describe('AuditService', () => {
  let service: AuditService;
  let activityLogRepository: MockRepository;
  let paymentLogRepository: MockRepository;

  const createMockQueryBuilder = () => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  });

  beforeEach(() => {
    activityLogRepository = {
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    paymentLogRepository = {
      createQueryBuilder: jest.fn(),
    };

    service = new AuditService(
      activityLogRepository as any,
      paymentLogRepository as any,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates and saves an activity log', async () => {
    const log = { id: 'log-1' };
    activityLogRepository.create.mockReturnValue(log);
    activityLogRepository.save.mockResolvedValue(log);

    const result = await service.createActivityLog(
      'org-1',
      'user-1',
      'UPDATE',
      'Form',
      'form-1',
      { data: true },
      '127.0.0.1',
      'agent',
    );

    expect(activityLogRepository.create).toHaveBeenCalledWith({
      organization_id: 'org-1',
      user_id: 'user-1',
      action: 'UPDATE',
      entity_type: 'Form',
      entity_id: 'form-1',
      metadata: { data: true },
      ip_address: '127.0.0.1',
      user_agent: 'agent',
    });
    expect(activityLogRepository.save).toHaveBeenCalledWith(log);
    expect(result).toBe(log);
  });

  it('lists activity logs with filters and pagination', async () => {
    const queryBuilder = createMockQueryBuilder();
    queryBuilder.getManyAndCount.mockResolvedValue([[{ id: 'log-1' }], 1]);
    activityLogRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.listActivityLogs('org-1', 2, 10, {
      action: 'CREATE',
      entity_type: 'Form',
      entity_id: 'form-1',
      user_id: 'user-1',
      ip_address: '127.0.0.1',
      user_agent: 'agent',
      keyword: 'search',
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(activityLogRepository.createQueryBuilder).toHaveBeenCalledWith('log');
    expect(queryBuilder.where).toHaveBeenCalledWith('log.organization_id = :organizationId', { organizationId: 'org-1' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.action = :action', { action: 'CREATE' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.entity_type = :entity_type', { entity_type: 'Form' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.entity_id = :entity_id', { entity_id: 'form-1' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.user_id = :user_id', { user_id: 'user-1' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.ip_address ILIKE :ip_address', { ip_address: '%127.0.0.1%' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.user_agent ILIKE :user_agent', { user_agent: '%agent%' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.created_at >= :from', { from: '2026-01-01' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.created_at <= :to', { to: '2026-01-31' });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('log.created_at', 'DESC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
    expect(result).toEqual({ data: [{ id: 'log-1' }], total: 1, page: 2, limit: 10 });
  });

  it('lists payment logs with filters and pagination', async () => {
    const queryBuilder = createMockQueryBuilder();
    queryBuilder.getManyAndCount.mockResolvedValue([[{ id: 'payment-log-1' }], 1]);
    paymentLogRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.listPaymentLogs('org-1', 'payment-1', 3, 5, {
      event: 'NOTIFY',
      event_id: 'event-1',
      keyword: 'keyword',
      from: '2026-02-01',
      to: '2026-02-28',
    });

    expect(paymentLogRepository.createQueryBuilder).toHaveBeenCalledWith('log');
    expect(queryBuilder.where).toHaveBeenCalledWith('log.organization_id = :organizationId', { organizationId: 'org-1' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.payment_id = :paymentId', { paymentId: 'payment-1' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.event = :event', { event: 'NOTIFY' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.event_id = :event_id', { event_id: 'event-1' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.created_at >= :from', { from: '2026-02-01' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.created_at <= :to', { to: '2026-02-28' });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('log.created_at', 'DESC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(5);
    expect(result).toEqual({ data: [{ id: 'payment-log-1' }], total: 1, page: 3, limit: 5 });
  });
});
