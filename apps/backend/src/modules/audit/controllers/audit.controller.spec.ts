import { AuditController } from './audit.controller';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: any;

  beforeEach(() => {
    auditService = {
      listActivityLogs: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
      listPaymentLogs: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    };

    controller = new AuditController(auditService);
  });

  it('calls listActivityLogs with request user organization and filters', async () => {
    const req = { user: { organization_id: 'org-1' } } as any;

    const result = await controller.getActivityLogs(req, 2, 15, 'CREATE', 'Form', 'form-1', 'user-1', '127.0.0.1', 'agent', 'term', '2026-01-01', '2026-01-31');

    expect(auditService.listActivityLogs).toHaveBeenCalledWith('org-1', 2, 15, {
      action: 'CREATE',
      entity_type: 'Form',
      entity_id: 'form-1',
      user_id: 'user-1',
      ip_address: '127.0.0.1',
      user_agent: 'agent',
      keyword: 'term',
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('calls listPaymentLogs with request user organization and filters', async () => {
    const req = { user: { organization_id: 'org-1' } } as any;

    const result = await controller.getPaymentLogs(req, 'payment-1', 3, 10, 'EVENT', 'event-1', 'term', '2026-02-01', '2026-02-28');

    expect(auditService.listPaymentLogs).toHaveBeenCalledWith('org-1', 'payment-1', 3, 10, {
      event: 'EVENT',
      event_id: 'event-1',
      keyword: 'term',
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });
});
