import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;

  const paymentRepository = {
    findOne: jest.fn(),
  };
  const organizationRepository = {
    findOne: jest.fn(),
  };
  const submissionRepository = {};
  const contactRepository = {
    findOne: jest.fn(),
  };
  const formRepository = {
    findOne: jest.fn(),
  };
  const paymentLogRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const userRepository = {};
  const configService = {
    get: jest.fn(),
  };
  const notificationService = {
    sendPaymentConfirmation: jest.fn(),
    sendFailedPaymentReminder: jest.fn(),
    createContactPaymentStatusNotification: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentService(
      paymentRepository as any,
      organizationRepository as any,
      submissionRepository as any,
      contactRepository as any,
      formRepository as any,
      paymentLogRepository as any,
      userRepository as any,
      configService as any,
      notificationService as any,
    );
  });

  it('creates contact in-app payment notification on webhook status change', async () => {
    const payment = {
      id: 'payment-1',
      organization_id: 'org-1',
      submission: {
        id: 'submission-1',
        contact_id: 'contact-1',
        form_id: 'form-1',
      },
      status: 'PENDING',
      amount: 1500,
      total_amount: null,
      amount_paid: 0,
      balance_due: 1500,
      payment_method: 'ONLINE',
      reference: 'REF-1',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    };

    paymentRepository.findOne.mockResolvedValue(payment);
    paymentLogRepository.findOne.mockResolvedValue(null);
    paymentLogRepository.create.mockImplementation((payload: any) => payload);
    paymentLogRepository.save.mockResolvedValue({});
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      partial_payment_limit: null,
      notify_payment_confirmation: false,
      notify_payment_failure: false,
    });
    formRepository.findOne.mockResolvedValue({ title: 'School Fees' });
    contactRepository.findOne.mockResolvedValue(null);
    notificationService.createContactPaymentStatusNotification.mockResolvedValue({});

    jest.spyOn(service, 'updateStatus').mockResolvedValue({
      ...payment,
      status: 'PAID',
    } as any);

    const result = await service.handleWebhookEvent(
      'org-1',
      'charge.success',
      { reference: 'REF-1', status: 'success', amount: 150000 },
      'evt-1',
    );

    expect(result.success).toBe(true);
    expect(notificationService.createContactPaymentStatusNotification).toHaveBeenCalledWith(
      'org-1',
      'contact-1',
      expect.objectContaining({
        payment_id: 'payment-1',
        form_id: 'form-1',
        form_title: 'School Fees',
        reference: 'REF-1',
        status: 'PAID',
        previous_status: 'PENDING',
      }),
    );
  });

  it('returns enriched transactions with form and customer fields', async () => {
    const schema = {
      payment_method: true,
      confirmed_at: true,
      confirmed_by_user_id: true,
      confirmation_note: true,
      external_reference: true,
    };
    jest.spyOn(service as any, 'getPaymentSchemaAvailability').mockResolvedValue(schema);

    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      clone: jest.fn(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn().mockResolvedValue({
        entities: [
          {
            id: 'payment-1',
            submission_id: 'submission-1',
            organization_id: 'org-1',
            reference: 'REF-1',
            amount: 2500,
            total_amount: null,
            amount_paid: 2500,
            balance_due: 0,
            status: 'PAID',
            payment_method: 'ONLINE',
            paid_at: new Date('2026-01-01T00:00:00.000Z'),
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            submission: {
              id: 'submission-1',
              form_id: 'form-1',
              contact_id: 'contact-1',
            },
          },
        ],
        raw: [
          {
            payment_id: 'payment-1',
            form_title: 'School Fees',
            contact_first_name: 'Ada',
            contact_middle_name: null,
            contact_last_name: 'Lovelace',
            contact_email: 'ada@example.com',
          },
        ],
      }),
    };
    qb.clone.mockReturnValue({
      getCount: jest.fn().mockResolvedValue(1),
    });

    jest.spyOn(service as any, 'buildTransactionsQuery').mockReturnValue(qb);

    const result = await service.findTransactions('org-1', {}, 1, 20);

    expect(result.total).toBe(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'payment-1',
        form_title: 'School Fees',
        customer_name: 'Ada Lovelace',
        customer_email: 'ada@example.com',
      }),
    );
  });
});
