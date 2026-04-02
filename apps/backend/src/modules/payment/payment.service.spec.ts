import axios from 'axios';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentService } from './services/payment.service';

jest.mock('axios');
import { Payment } from './entities/payment.entity';
import { Organization } from '../organization/entities/organization.entity';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

type MockRepository = Record<string, any>;

const createMockRepository = (): MockRepository => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  update: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: MockRepository;
  let organizationRepository: MockRepository;
  let submissionRepository: MockRepository;
  let contactRepository: MockRepository;
  let paymentLogRepository: MockRepository;
  let configService: any;
  let notificationService: any;
  let queryBuilder: any;

  beforeEach(() => {
    paymentRepository = createMockRepository();
    organizationRepository = createMockRepository();
    submissionRepository = createMockRepository();
    contactRepository = createMockRepository();
    paymentLogRepository = createMockRepository();

    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getMany: jest.fn(),
    };

    paymentRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    configService = { get: jest.fn().mockReturnValue('http://localhost:3000') };
    notificationService = { sendPaymentConfirmation: jest.fn().mockResolvedValue(undefined), sendFailedPaymentReminder: jest.fn().mockResolvedValue(undefined) };

    service = new PaymentService(
      paymentRepository as any,
      organizationRepository as any,
      submissionRepository as any,
      contactRepository as any,
      paymentLogRepository as any,
      configService as any,
      notificationService as any,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates a payment with generated reference', async () => {
    const dto = { submission_id: 'submission-1', amount: 1000 };
    const saved = { id: 'payment-1', ...dto, organization_id: 'org-1', reference: 'REF-123', status: 'PENDING' } as Payment;

    paymentRepository.create.mockReturnValue({ ...dto, organization_id: 'org-1', status: 'PENDING' });
    paymentRepository.save.mockResolvedValue(saved);

    const result = await service.create('org-1', dto as any);

    expect(paymentRepository.create).toHaveBeenCalledWith(expect.objectContaining({ organization_id: 'org-1', submission_id: 'submission-1', amount: 1000, status: 'PENDING' }));
    expect(paymentRepository.save).toHaveBeenCalled();
    expect(result).toEqual(saved);
  });

  it('finds payments by organization', async () => {
    const payments = [{ id: 'payment-1' }];
    paymentRepository.findAndCount.mockResolvedValue([payments, 1]);

    const result = await service.findByOrganization('org-1', 2, 10);

    expect(paymentRepository.findAndCount).toHaveBeenCalledWith({
      where: { organization_id: 'org-1' },
      skip: 10,
      take: 10,
      order: { created_at: 'DESC' },
    });
    expect(result).toEqual({ data: payments, total: 1, page: 2, limit: 10 });
  });

  it('finds payment by id and reference', async () => {
    const payment = { id: 'payment-1' } as Payment;
    paymentRepository.findOne.mockResolvedValue(payment);

    const byId = await service.findById('org-1', 'payment-1');
    const byRef = await service.findByReference('org-1', 'ref-1');

    expect(paymentRepository.findOne).toHaveBeenCalledWith({ where: { id: 'payment-1', organization_id: 'org-1' }, relations: ['submission'] });
    expect(paymentRepository.findOne).toHaveBeenCalledWith({ where: { reference: 'ref-1', organization_id: 'org-1' }, relations: ['submission'] });
    expect(byId).toEqual(payment);
    expect(byRef).toEqual(payment);
  });

  it('throws when customer email is missing for paystack initialization', async () => {
    const payment = { id: 'payment-1', submission_id: 'submission-1', reference: 'ref-1', amount: 100 } as Payment;
    organizationRepository.findOne.mockResolvedValue({ id: 'org-1', paystack_secret_key: 'secret' } as Organization);
    submissionRepository.findOne.mockResolvedValue(null);

    await expect(
      service.initializePaystack('org-1', payment, 'https://callback'),
    ).rejects.toThrow(BadRequestException);
  });

  it('finds transactions with filters', async () => {
    const transactions = [{ id: 'payment-1' }];
    queryBuilder.getManyAndCount.mockResolvedValue([transactions, 1]);

    const result = await service.findTransactions('org-1', { status: 'PAID', reference: 'ref', form_id: 'form-1', contact_id: 'contact-1', start_date: '2026-01-01', end_date: '2026-01-31' }, 1, 5);

    expect(queryBuilder.andWhere).toHaveBeenCalled();
    expect(queryBuilder.getManyAndCount).toHaveBeenCalled();
    expect(result).toEqual({ data: transactions, total: 1, page: 1, limit: 5 });
  });

  it('exports transactions as CSV', async () => {
    queryBuilder.getMany.mockResolvedValue([
      {
        id: 'payment-1',
        reference: 'ref-1',
        amount: 500,
        status: 'PAID',
        paid_at: new Date('2026-01-02T00:00:00.000Z'),
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        submission_id: 'submission-1',
        submission: { form_id: 'form-1', contact_id: 'contact-1' },
      },
    ]);

    const csv = await service.exportTransactions('org-1', { status: 'PAID' });

    expect(csv).toContain('id,reference,amount,status,paid_at,created_at,submission_id,form_id,contact_id');
    expect(csv).toContain('ref-1');
    expect(csv).toContain('submission-1');
  });

  it('escapes formula-like CSV values in exports', async () => {
    queryBuilder.getMany.mockResolvedValue([
      {
        id: 'payment-1',
        reference: '=cmd',
        amount: 500,
        status: 'PAID',
        paid_at: new Date('2026-01-02T00:00:00.000Z'),
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        submission_id: 'submission-1',
        submission: { form_id: 'form-1', contact_id: 'contact-1' },
      },
    ]);

    const csv = await service.exportTransactions('org-1', {});

    expect(csv).toContain(`"'=cmd"`);
  });

  it('exports all organization payments as CSV', async () => {
    queryBuilder.getMany.mockResolvedValue([
      {
        id: 'payment-2',
        reference: 'ref-2',
        amount: 750,
        status: 'PENDING',
        paid_at: null,
        created_at: new Date('2026-01-03T00:00:00.000Z'),
        submission_id: 'submission-2',
        submission: { form_id: 'form-2', contact_id: 'contact-2' },
      },
    ]);

    const csv = await service.exportByOrganization('org-1');

    expect(csv).toContain('id,reference,amount,status,paid_at,created_at,submission_id,form_id,contact_id');
    expect(csv).toContain('ref-2');
    expect(csv).toContain('submission-2');
  });

  it('returns transaction history for a payment', async () => {
    const payment = { id: 'payment-1' } as Payment;
    paymentRepository.findOne.mockResolvedValue(payment);
    paymentLogRepository.findAndCount.mockResolvedValue([[{ id: 'log-1' }], 1]);

    const result = await service.getTransactionHistory('org-1', 'payment-1', 1, 10);

    expect(result).toEqual({ data: [{ id: 'log-1' }], total: 1, page: 1, limit: 10 });
  });

  it('throws when transaction history payment not found', async () => {
    paymentRepository.findOne.mockResolvedValue(null);

    await expect(service.getTransactionHistory('org-1', 'payment-1', 1, 10)).rejects.toThrow(NotFoundException);
  });

  it('validates paystack webhook signature and returns organization id', async () => {
    const rawBody = JSON.stringify({ event: 'test' });
    const secretKey = 'secret-key';
    const expectedSignature = require('crypto').createHmac('sha512', secretKey).update(rawBody).digest('hex');

    organizationRepository.find.mockResolvedValue([{ id: 'org-1', paystack_secret_key: secretKey }] as Organization[]);

    const result = await service.validatePaystackWebhookSignature(rawBody, expectedSignature);

    expect(result).toBe('org-1');
  });

  it('updates payment status and returns payment', async () => {
    const payment = { id: 'payment-1' } as Payment;
    paymentRepository.update.mockResolvedValue(undefined);
    paymentRepository.findOne.mockResolvedValue(payment);

    const result = await service.updateStatus('org-1', 'payment-1', { status: 'PAID' } as any);

    expect(paymentRepository.update).toHaveBeenCalledWith(
      { id: 'payment-1', organization_id: 'org-1' },
      expect.objectContaining({ status: 'PAID' }),
    );
    expect(result).toEqual(payment);
  });

  it('handles webhook event and creates a payment log', async () => {
    const payment = { id: 'payment-1', reference: 'ref-1', amount: 500, organization_id: 'org-1', submission: { contact_id: 'contact-1' } } as any;
    const org = { id: 'org-1', notify_payment_confirmation: true, paystack_secret_key: 'secret' } as Organization;
    const contact = { email: 'customer@example.com' };

    paymentRepository.findOne.mockResolvedValue(payment);
    paymentLogRepository.findOne.mockResolvedValue(null);
    organizationRepository.findOne.mockResolvedValue(org);
    contactRepository.findOne.mockResolvedValue(contact);
    paymentRepository.update.mockResolvedValue(undefined);
    paymentLogRepository.create.mockReturnValue({});
    paymentLogRepository.save.mockResolvedValue({});

    const result = await service.handleWebhookEvent('org-1', 'charge.success', { reference: 'ref-1', status: 'success', customer: { email: 'customer@example.com' } }, 'event-1');

    expect(paymentLogRepository.save).toHaveBeenCalled();
    expect(notificationService.sendPaymentConfirmation).toHaveBeenCalledWith(org, 'customer@example.com', 500, 'ref-1');
    expect(result).toEqual({ success: true });
  });
});
