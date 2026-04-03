import { ContactAuthController } from './contact-auth.controller';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

type MockContactAuthService = ReturnType<typeof mockContactAuthService>;
type MockPaymentService = ReturnType<typeof mockPaymentService>;

const mockContactAuthService = () => ({
  login: jest.fn(),
  setPassword: jest.fn(),
  requestPasswordReset: jest.fn(),
  confirmPasswordReset: jest.fn(),
});

const mockPaymentService = () => ({
  generateContactReceiptByPaymentId: jest.fn(),
  generateContactReceiptByReference: jest.fn(),
});

describe('ContactAuthController', () => {
  let controller: ContactAuthController;
  let service: MockContactAuthService;
  let paymentService: MockPaymentService;

  beforeEach(() => {
    service = mockContactAuthService();
    paymentService = mockPaymentService();
    controller = new ContactAuthController(service as any, paymentService as any);
  });

  it('logs in a contact', async () => {
    const dto = { email: 'contact@example.com', password: 'pass1234', organization_id: 'org-1' };
    const req = { headers: { host: 'school.payforms.com' } };
    service.login.mockResolvedValue({ access_token: 'token' });

    const result = await controller.login(dto as any, req as any);

    expect(service.login).toHaveBeenCalledWith(dto, 'school.payforms.com');
    expect(result).toEqual({ access_token: 'token' });
  });

  it('sets a contact password', async () => {
    const dto = { token: 'reset-token', password: 'NewPass123' };
    service.setPassword.mockResolvedValue({ id: 'contact-1' });

    const result = await controller.setPassword(dto as any);

    expect(service.setPassword).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'contact-1' });
  });

  it('requests password reset using both endpoints', async () => {
    const dto = { email: 'contact@example.com' };
    const req = {
      headers: { 'x-forwarded-host': 'pay.myuni.com' },
      get: () => 'localhost:3001',
    };
    service.requestPasswordReset.mockResolvedValue({ success: true });

    const result1 = await controller.requestPasswordReset(dto as any, req as any);
    const result2 = await controller.requestPasswordResetAlias(dto as any, req as any);

    expect(service.requestPasswordReset).toHaveBeenCalledTimes(2);
    expect(service.requestPasswordReset).toHaveBeenNthCalledWith(1, dto, 'pay.myuni.com');
    expect(service.requestPasswordReset).toHaveBeenNthCalledWith(2, dto, 'pay.myuni.com');
    expect(result1).toEqual({ success: true });
    expect(result2).toEqual({ success: true });
  });

  it('confirms password reset using both endpoints', async () => {
    const dto = { token: 'reset-token', password: 'NewPass123' };
    service.confirmPasswordReset.mockResolvedValue({ id: 'contact-1' });

    const result1 = await controller.confirmPasswordReset(dto as any);
    const result2 = await controller.confirmPasswordResetAlias(dto as any);

    expect(service.confirmPasswordReset).toHaveBeenCalledTimes(2);
    expect(result1).toEqual({ id: 'contact-1' });
    expect(result2).toEqual({ id: 'contact-1' });
  });

  it('returns the current contact user', async () => {
    const req = { user: { id: 'contact-1' } };

    const result = await controller.getCurrentContact(req as any);

    expect(result).toEqual({ id: 'contact-1' });
  });

  it('downloads payment receipt by payment id', async () => {
    const req = { user: { id: 'contact-1', organization_id: 'org-1' } };
    const res = { setHeader: jest.fn() };
    const content = Buffer.from('pdf-content');
    paymentService.generateContactReceiptByPaymentId.mockResolvedValue({
      fileName: 'receipt-ref.pdf',
      content,
    });

    const result = await controller.downloadPaymentReceipt(req as any, 'payment-1', res as any);

    expect(paymentService.generateContactReceiptByPaymentId).toHaveBeenCalledWith('org-1', 'contact-1', 'payment-1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="receipt-ref.pdf"');
    expect(result).toEqual(content);
  });

  it('downloads payment receipt by reference', async () => {
    const req = { user: { id: 'contact-1', organization_id: 'org-1' } };
    const res = { setHeader: jest.fn() };
    const content = Buffer.from('pdf-content');
    paymentService.generateContactReceiptByReference.mockResolvedValue({
      fileName: 'receipt-ref.pdf',
      content,
    });

    const result = await controller.downloadPaymentReceiptByReference(req as any, 'ref-1', res as any);

    expect(paymentService.generateContactReceiptByReference).toHaveBeenCalledWith('org-1', 'contact-1', 'ref-1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="receipt-ref.pdf"');
    expect(result).toEqual(content);
  });
});
