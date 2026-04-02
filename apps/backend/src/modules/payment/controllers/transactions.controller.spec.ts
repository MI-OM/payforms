import { TransactionsController } from './transactions.controller';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

type MockPaymentService = ReturnType<typeof mockPaymentService>;

const mockPaymentService = () => ({
  findTransactions: jest.fn(),
  exportTransactions: jest.fn(),
  findById: jest.fn(),
  getTransactionHistory: jest.fn(),
});

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: MockPaymentService;

  beforeEach(() => {
    service = mockPaymentService();
    controller = new TransactionsController(service as any);
  });

  it('lists transactions with query filters', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const query = { status: 'PAID', reference: 'ref', form_id: 'form-1', contact_id: 'contact-1', start_date: '2026-01-01', end_date: '2026-01-31', page: 2, limit: 5 };
    service.findTransactions.mockResolvedValue({ data: [], total: 0, page: 2, limit: 5 });

    const result = await controller.listTransactions(req as any, query as any);

    expect(service.findTransactions).toHaveBeenCalledWith('org-1', {
      status: 'PAID',
      reference: 'ref',
      form_id: 'form-1',
      contact_id: 'contact-1',
      start_date: '2026-01-01',
      end_date: '2026-01-31',
    }, 2, 5);
    expect(result).toEqual({ data: [], total: 0, page: 2, limit: 5 });
  });

  it('exports transactions as CSV', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const res = { setHeader: jest.fn() };
    const query = { status: 'PAID', format: 'csv' };
    service.exportTransactions.mockResolvedValue('csv-data');

    const result = await controller.listTransactions(req as any, query as any, res as any);

    expect(service.exportTransactions).toHaveBeenCalledWith('org-1', {
      status: 'PAID',
      reference: undefined,
      form_id: undefined,
      contact_id: undefined,
      start_date: undefined,
      end_date: undefined,
    });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="transactions.csv"');
    expect(result).toEqual('csv-data');
  });

  it('gets a transaction by id', async () => {
    const req = { user: { organization_id: 'org-1' } };
    service.findById.mockResolvedValue({ id: 'payment-1' });

    const result = await controller.getTransaction(req as any, 'payment-1');

    expect(service.findById).toHaveBeenCalledWith('org-1', 'payment-1');
    expect(result).toEqual({ id: 'payment-1' });
  });

  it('gets transaction history', async () => {
    const req = { user: { organization_id: 'org-1' } };
    service.getTransactionHistory.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    const result = await controller.getTransactionHistory(req as any, 'payment-1', 1, 20);

    expect(service.getTransactionHistory).toHaveBeenCalledWith('org-1', 'payment-1', 1, 20);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });
});
