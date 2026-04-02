import { WebhookController } from './webhook.controller';
import { BadRequestException } from '@nestjs/common';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

type MockPaymentService = ReturnType<typeof mockPaymentService>;

const mockPaymentService = () => ({
  validatePaystackWebhookSignature: jest.fn(),
  handleWebhookEvent: jest.fn(),
});

describe('WebhookController', () => {
  let controller: WebhookController;
  let service: MockPaymentService;

  beforeEach(() => {
    service = mockPaymentService();
    controller = new WebhookController(service as any);
  });

  it('handles valid paystack webhook', async () => {
    service.validatePaystackWebhookSignature.mockResolvedValue('org-1');
    service.handleWebhookEvent.mockResolvedValue(undefined);

    const req: any = { rawBody: JSON.stringify({ event: 'charge.success', id: 'evt-1', data: { reference: 'ref-1' } }) };
    const result = await controller.handlePaystackWebhook(req, 'signature');

    expect(service.validatePaystackWebhookSignature).toHaveBeenCalledWith(req.rawBody, 'signature');
    expect(service.handleWebhookEvent).toHaveBeenCalledWith('org-1', 'charge.success', { reference: 'ref-1' }, 'evt-1');
    expect(result).toEqual({ status: 'success' });
  });

  it('throws when signature is missing', async () => {
    const req: any = { rawBody: JSON.stringify({}) };

    await expect(controller.handlePaystackWebhook(req, '')).rejects.toThrow(BadRequestException);
  });

  it('throws when webhook payload is invalid JSON', async () => {
    service.validatePaystackWebhookSignature.mockResolvedValue('org-1');
    const req: any = { rawBody: 'not-json' };

    await expect(controller.handlePaystackWebhook(req, 'signature')).rejects.toThrow(BadRequestException);
  });
});
