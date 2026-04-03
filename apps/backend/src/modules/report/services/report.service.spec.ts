import { BadRequestException } from '@nestjs/common';
import { ReportService } from './report.service';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

type MockRepository = Record<string, any>;

type MockQueryBuilder = Record<string, any>;

const createMockQueryBuilder = (): MockQueryBuilder => ({
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  setParameters: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getCount: jest.fn(),
  getRawOne: jest.fn(),
  getRawMany: jest.fn(),
});

describe('ReportService', () => {
  let service: ReportService;
  let formRepository: MockRepository;
  let submissionRepository: MockRepository;
  let paymentRepository: MockRepository;
  let contactRepository: MockRepository;

  beforeEach(() => {
    formRepository = { count: jest.fn(), find: jest.fn() };
    submissionRepository = { createQueryBuilder: jest.fn() };
    paymentRepository = { createQueryBuilder: jest.fn() };
    contactRepository = { count: jest.fn() };

    service = new ReportService(
      formRepository as any,
      submissionRepository as any,
      paymentRepository as any,
      contactRepository as any,
    );
  });

  it('throws BadRequestException for invalid start_date', async () => {
    await expect(service.getSummary('org-1', 'invalid-date', '2026-01-31')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for invalid end_date', async () => {
    await expect(service.getAnalytics('org-1', '2026-01-01', 'invalid-date')).rejects.toThrow(BadRequestException);
  });

  it('returns summary data with date range and totals', async () => {
    formRepository.count.mockResolvedValue(2);
    contactRepository.count.mockResolvedValue(3);

    const submissionQuery = createMockQueryBuilder();
    submissionQuery.getCount.mockResolvedValue(4);

    const paymentQuery = createMockQueryBuilder();
    paymentQuery.getRawOne.mockResolvedValue({
      count: '5',
      total: '1000',
      paid_total: '600',
      pending_total: '200',
      failed_total: '100',
      partial_total: '100',
    });

    submissionRepository.createQueryBuilder.mockReturnValueOnce(submissionQuery);
    paymentRepository.createQueryBuilder.mockReturnValueOnce(paymentQuery);

    const result = await service.getSummary('org-1', '2026-01-01', '2026-01-31');

    expect(formRepository.count).toHaveBeenCalledWith({ where: { organization_id: 'org-1' } });
    expect(contactRepository.count).toHaveBeenCalledWith({ where: { organization_id: 'org-1' } });
    expect(submissionQuery.where).toHaveBeenCalledWith('submission.organization_id = :organizationId', { organizationId: 'org-1' });
    expect(paymentQuery.where).toHaveBeenCalledWith('payment.organization_id = :organizationId', { organizationId: 'org-1' });

    expect(result).toMatchObject({
      forms: 2,
      contacts: 3,
      submissions: 4,
      payments: 5,
      payment_total: 1000,
      payment_paid_total: 600,
      payment_pending_total: 200,
      payment_failed_total: 100,
      payment_partial_total: 100,
      range: {
        start: expect.any(String),
        end: expect.any(String),
      },
    });
  });

  it('returns analytics results with grouped day data and status breakdown', async () => {
    const submissionsByDayQuery = createMockQueryBuilder();
    submissionsByDayQuery.getRawMany.mockResolvedValue([
      { day: new Date('2026-01-01'), count: '2' },
    ]);

    const paymentsByDayQuery = createMockQueryBuilder();
    paymentsByDayQuery.getRawMany.mockResolvedValue([
      { day: new Date('2026-01-01'), total: '1500', count: '3' },
    ]);

    const paymentStatusQuery = createMockQueryBuilder();
    paymentStatusQuery.getRawMany.mockResolvedValue([
      { status: 'PAID', count: '2', total_amount: '1500' },
    ]);

    submissionRepository.createQueryBuilder.mockReturnValueOnce(submissionsByDayQuery);
    paymentRepository.createQueryBuilder
      .mockReturnValueOnce(paymentsByDayQuery)
      .mockReturnValueOnce(paymentStatusQuery);

    const result = await service.getAnalytics('org-1', '2026-01-01', '2026-01-31');

    expect(result.range.start).toBe('2026-01-01T00:00:00.000Z');
    expect(result.range.end).toBe('2026-01-31T00:00:00.000Z');
    expect(result.submissions_by_day).toEqual([{ day: '2026-01-01', count: 2 }]);
    expect(result.payments_by_day).toEqual([{ day: '2026-01-01', total: 1500, count: 3 }]);
    expect(result.payment_status_breakdown).toEqual([{ status: 'PAID', count: 2, total_amount: 1500 }]);
  });

  it('returns per-form performance metrics', async () => {
    formRepository.find.mockResolvedValue([
      { id: 'form-1', title: 'School Fees', slug: 'school-fees', is_active: true, created_at: new Date('2026-01-01T00:00:00.000Z') },
      { id: 'form-2', title: 'Hostel Fees', slug: 'hostel-fees', is_active: false, created_at: new Date('2026-01-02T00:00:00.000Z') },
    ]);

    const submissionsQuery = createMockQueryBuilder();
    submissionsQuery.getRawMany.mockResolvedValue([
      { form_id: 'form-1', submissions: '3' },
    ]);

    const paymentsQuery = createMockQueryBuilder();
    paymentsQuery.getRawMany.mockResolvedValue([
      {
        form_id: 'form-1',
        payments: '2',
        paid_payments: '1',
        pending_payments: '1',
        failed_payments: '0',
        partial_payments: '0',
        amount_total: '500',
        paid_amount_total: '300',
        pending_amount_total: '200',
        failed_amount_total: '0',
        partial_amount_total: '0',
      },
    ]);

    submissionRepository.createQueryBuilder.mockReturnValueOnce(submissionsQuery);
    paymentRepository.createQueryBuilder.mockReturnValueOnce(paymentsQuery);

    const result = await service.getFormPerformance('org-1', '2026-01-01', '2026-01-31');

    expect(result.totals).toEqual({
      forms: 2,
      submissions: 3,
      payments: 2,
      amount_total: 500,
      paid_amount_total: 300,
    });
    expect(result.data).toEqual([
      {
        form_id: 'form-1',
        title: 'School Fees',
        slug: 'school-fees',
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        submissions: 3,
        payments: 2,
        paid_payments: 1,
        pending_payments: 1,
        failed_payments: 0,
        partial_payments: 0,
        amount_total: 500,
        paid_amount_total: 300,
        pending_amount_total: 200,
        failed_amount_total: 0,
        partial_amount_total: 0,
        completion_rate: 33.33,
        collection_rate: 60,
      },
      {
        form_id: 'form-2',
        title: 'Hostel Fees',
        slug: 'hostel-fees',
        is_active: false,
        created_at: '2026-01-02T00:00:00.000Z',
        submissions: 0,
        payments: 0,
        paid_payments: 0,
        pending_payments: 0,
        failed_payments: 0,
        partial_payments: 0,
        amount_total: 0,
        paid_amount_total: 0,
        pending_amount_total: 0,
        failed_amount_total: 0,
        partial_amount_total: 0,
        completion_rate: 0,
        collection_rate: 0,
      },
    ]);
  });

  it('exports summary as csv', async () => {
    jest.spyOn(service, 'getSummary').mockResolvedValue({
      forms: 1,
      contacts: 2,
      submissions: 3,
      payments: 4,
      payment_total: 100,
      payment_paid_total: 80,
      payment_pending_total: 10,
      payment_failed_total: 5,
      payment_partial_total: 5,
      range: { start: null, end: null },
    } as any);

    const csv = await service.exportReport('org-1', 'summary', 'csv');

    expect(csv).toContain('"Metric","Value"');
    expect(csv).toContain('"Forms","1"');
    expect(csv).toContain('"Payments","4"');
  });

  it('exports summary as pdf buffer', async () => {
    jest.spyOn(service, 'getSummary').mockResolvedValue({
      forms: 1,
      contacts: 2,
      submissions: 3,
      payments: 4,
      payment_total: 100,
      payment_paid_total: 80,
      payment_pending_total: 10,
      payment_failed_total: 5,
      payment_partial_total: 5,
      range: { start: null, end: null },
    } as any);

    const output = await service.exportReport('org-1', 'summary', 'pdf');

    expect(output).toBeInstanceOf(Buffer);
    expect(output.length).toBeGreaterThan(0);
  });

  it('throws BadRequestException for unsupported export format', async () => {
    jest.spyOn(service, 'getSummary').mockResolvedValue({
      forms: 1,
      contacts: 2,
      submissions: 3,
      payments: 4,
      payment_total: 100,
      payment_paid_total: 80,
      payment_pending_total: 10,
      payment_failed_total: 5,
      payment_partial_total: 5,
      range: { start: null, end: null },
    } as any);

    await expect(service.exportReport('org-1', 'summary', 'xml' as any)).rejects.toThrow(BadRequestException);
  });
});
