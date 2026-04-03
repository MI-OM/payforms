import { PaymentController } from './payment.controller';
import { NotFoundException } from '@nestjs/common';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

type MockPaymentService = ReturnType<typeof mockPaymentService>;

const mockPaymentService = () => ({
  findByOrganization: jest.fn(),
  exportByOrganization: jest.fn(),
  findById: jest.fn(),
  verifyAndFinalizePayment: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
});

describe('PaymentController', () => {
  let controller: PaymentController;
  let service: MockPaymentService;

  beforeEach(() => {
    service = mockPaymentService();
    controller = new PaymentController(service as any);
  });

  it('lists payments', async () => {
    const req = { user: { organization_id: 'org-1' } };
    service.findByOrganization.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    const result = await controller.listPayments(req as any, 1, 20);

    expect(service.findByOrganization).toHaveBeenCalledWith('org-1', 1, 20);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('exports payments as CSV', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const res = { setHeader: jest.fn() };
    service.exportByOrganization.mockResolvedValue('csv-data');

    const result = await controller.listPayments(req as any, 1, 20, 'csv' as any, res as any);

    expect(service.exportByOrganization).toHaveBeenCalledWith('org-1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="payments.csv"');
    expect(result).toEqual('csv-data');
  });

  it('gets a payment by id', async () => {
    const req = { user: { organization_id: 'org-1' } };
    service.findById.mockResolvedValue({ id: 'payment-1' });

    const result = await controller.getPayment(req as any, 'payment-1');

    expect(service.findById).toHaveBeenCalledWith('org-1', 'payment-1');
    expect(result).toEqual({ id: 'payment-1' });
  });

  it('verifies a payment and returns result when found', async () => {
    const req = { user: { organization_id: 'org-1' } };
    service.verifyAndFinalizePayment.mockResolvedValue({
      success: true,
      payment: { id: 'payment-1', status: 'PAID' },
      verified: { status: 'success' },
    });

    const result = await controller.verifyPayment(req as any, 'ref-1');

    expect(service.verifyAndFinalizePayment).toHaveBeenCalledWith('org-1', 'ref-1', 'manual_verify');
    expect(result).toEqual({
      success: true,
      payment: { id: 'payment-1', status: 'PAID' },
      verified: { status: 'success' },
    });
  });

  it('returns error when payment reference is missing', async () => {
    const req = { user: { organization_id: 'org-1' } };
    service.verifyAndFinalizePayment.mockRejectedValue(new NotFoundException('Payment not found'));

    const result = await controller.verifyPayment(req as any, 'ref-1');

    expect(result).toEqual({ error: 'Payment not found' });
  });

  it('creates a payment', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const dto = { submission_id: 'submission-1', amount: 1000 };
    service.create.mockResolvedValue({ id: 'payment-1' });

    const result = await controller.createPayment(req as any, dto as any);

    expect(service.create).toHaveBeenCalledWith('org-1', dto);
    expect(result).toEqual({ id: 'payment-1' });
  });

  it('updates payment status', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const dto = { status: 'PAID' };
    service.updateStatus.mockResolvedValue({ id: 'payment-1', status: 'PAID' });

    const result = await controller.updatePaymentStatus(req as any, 'payment-1', dto as any);

    expect(service.updateStatus).toHaveBeenCalledWith('org-1', 'payment-1', dto);
    expect(result).toEqual({ id: 'payment-1', status: 'PAID' });
  });
});
