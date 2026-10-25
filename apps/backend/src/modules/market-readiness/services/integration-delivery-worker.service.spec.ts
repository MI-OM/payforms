import { IntegrationDeliveryWorkerService } from './integration-delivery-worker.service';
import { IntegrationDelivery } from '../entities/integration-delivery.entity';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

jest.mock('dns/promises', () => ({
  lookup: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dns = require('dns/promises');

describe('IntegrationDeliveryWorkerService', () => {
  let service: IntegrationDeliveryWorkerService;

  const deliveryRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((payload) => payload),
  };

  const endpointRepository = {
    findOne: jest.fn(),
  };

  const endpoint = {
    id: 'endpoint-1',
    organization_id: 'org-1',
    type: 'WEBHOOK',
    target: 'https://example.com/hook',
    secret: 'top-secret',
    active: true,
    config: null,
  } as unknown as IntegrationEndpoint;

  const buildDelivery = (overrides: Partial<IntegrationDelivery> = {}): IntegrationDelivery =>
    ({
      id: 'delivery-1',
      organization_id: 'org-1',
      endpoint_id: 'endpoint-1',
      event_type: 'payment.completed',
      payload_hash: 'hash',
      payload: { reference: 'ref-1' },
      status: 'QUEUED',
      attempts: 0,
      last_error: null,
      response_status: null,
      response_body: null,
      delivered_at: null,
      next_attempt_at: null,
      last_attempt_at: null,
      organization: undefined,
      ...overrides,
    }) as unknown as IntegrationDelivery;

  beforeEach(() => {
    jest.clearAllMocks();
    (dns.lookup as jest.Mock).mockResolvedValue([{ address: '93.184.216.34' }]);
    deliveryRepository.save.mockImplementation(async (entity) => entity);

    service = new IntegrationDeliveryWorkerService(
      deliveryRepository as any,
      endpointRepository as any,
    );
  });

  describe('target validation', () => {
    it('rejects a non-HTTPS target', async () => {
      endpointRepository.findOne.mockResolvedValue({ ...endpoint, target: 'http://example.com' });
      const delivery = buildDelivery();

      const result = await service.deliverNow(delivery);

      expect(result.ok).toBe(false);
      expect(result.permanent).toBe(true);
      expect(result.error).toMatch(/HTTPS/);
      expect(delivery.status).toBe('FAILED');
    });

    it('rejects a target that resolves to a private address', async () => {
      (dns.lookup as jest.Mock).mockResolvedValue([{ address: '10.0.0.5' }]);
      endpointRepository.findOne.mockResolvedValue(endpoint);
      const delivery = buildDelivery();

      const result = await service.deliverNow(delivery);

      expect(result.ok).toBe(false);
      expect(result.permanent).toBe(true);
      expect(result.error).toMatch(/private/);
    });

    it('rejects a target that resolves to loopback', async () => {
      (dns.lookup as jest.Mock).mockResolvedValue([{ address: '127.0.0.1' }]);
      endpointRepository.findOne.mockResolvedValue(endpoint);

      const result = await service.deliverNow(buildDelivery());

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/private/);
    });

    it('rejects an IPv4-mapped IPv6 loopback address', async () => {
      (dns.lookup as jest.Mock).mockResolvedValue([{ address: '::ffff:127.0.0.1' }]);
      endpointRepository.findOne.mockResolvedValue(endpoint);

      const result = await service.deliverNow(buildDelivery());

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/private/);
    });

    it('rejects a target that embeds credentials', async () => {
      endpointRepository.findOne.mockResolvedValue({
        ...endpoint,
        target: 'https://user:pass@example.com/hook',
      });

      const result = await service.deliverNow(buildDelivery());

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/credentials/);
    });

    it('does not deliver when the endpoint is inactive', async () => {
      endpointRepository.findOne.mockResolvedValue({ ...endpoint, active: false });

      const result = await service.deliverNow(buildDelivery());

      expect(result.ok).toBe(false);
      expect(result.permanent).toBe(true);
      expect(result.error).toMatch(/inactive/);
    });
  });

  describe('delivery', () => {
    it('marks a 2xx response as delivered', async () => {
      endpointRepository.findOne.mockResolvedValue(endpoint);
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'ok',
      });
      (global as any).fetch = fetchMock;

      const delivery = buildDelivery();
      const result = await service.deliverNow(delivery);

      expect(result.ok).toBe(true);
      expect(delivery.status).toBe('DELIVERED');
      expect(delivery.delivered_at).toBeInstanceOf(Date);
      expect(delivery.attempts).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('signs the body with the endpoint secret', async () => {
      endpointRepository.findOne.mockResolvedValue(endpoint);
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204, text: async () => '' });
      (global as any).fetch = fetchMock;

      await service.deliverNow(buildDelivery());

      const [, init] = fetchMock.mock.calls[0];
      const header = init.headers['X-Payforms-Signature'] as string;

      expect(header).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
      expect(init.headers['X-Payforms-Event']).toBe('payment.completed');
      expect(init.headers['X-Payforms-Delivery']).toBe('delivery-1');
    });

    it('schedules a retry with backoff on a 500 response', async () => {
      endpointRepository.findOne.mockResolvedValue(endpoint);
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'boom',
      });

      const delivery = buildDelivery();
      const result = await service.deliverNow(delivery);

      expect(result.ok).toBe(false);
      expect(result.permanent).toBe(false);
      expect(delivery.status).toBe('QUEUED');
      expect(delivery.attempts).toBe(1);
      expect(delivery.next_attempt_at).toBeInstanceOf(Date);
      expect(delivery.next_attempt_at!.getTime()).toBeGreaterThan(Date.now());
    });

    it('treats a 404 as a permanent failure', async () => {
      endpointRepository.findOne.mockResolvedValue(endpoint);
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'not found',
      });

      const delivery = buildDelivery();
      const result = await service.deliverNow(delivery);

      expect(result.permanent).toBe(true);
      expect(delivery.status).toBe('FAILED');
      expect(delivery.next_attempt_at).toBeNull();
    });

    it('retries a 429 rather than treating it as permanent', async () => {
      endpointRepository.findOne.mockResolvedValue(endpoint);
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'slow down',
      });

      const delivery = buildDelivery();
      const result = await service.deliverNow(delivery);

      expect(result.permanent).toBe(false);
      expect(delivery.status).toBe('QUEUED');
    });

    it('gives up after the maximum number of attempts', async () => {
      endpointRepository.findOne.mockResolvedValue(endpoint);
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => '',
      });

      const delivery = buildDelivery({ attempts: 5 });
      await service.deliverNow(delivery);

      expect(delivery.attempts).toBe(6);
      expect(delivery.status).toBe('FAILED');
    });

    it('fails a delivery that has no stored payload', async () => {
      endpointRepository.findOne.mockResolvedValue(endpoint);
      const fetchMock = jest.fn();
      (global as any).fetch = fetchMock;

      const result = await service.deliverNow(buildDelivery({ payload: null }));

      expect(result.ok).toBe(false);
      expect(result.permanent).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fails when the endpoint no longer exists', async () => {
      endpointRepository.findOne.mockResolvedValue(null);

      const result = await service.deliverNow(buildDelivery());

      expect(result.ok).toBe(false);
      expect(result.permanent).toBe(true);
      expect(result.error).toMatch(/no longer exists/);
    });
  });

  describe('processDueDeliveries', () => {
    it('does nothing when no deliveries are due', async () => {
      deliveryRepository.find.mockResolvedValue([]);

      await service.processDueDeliveries();

      expect(deliveryRepository.save).not.toHaveBeenCalled();
    });

    it('delivers each due delivery', async () => {
      endpointRepository.findOne.mockResolvedValue(endpoint);
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'ok',
      });
      deliveryRepository.find.mockResolvedValue([
        buildDelivery({ id: 'd1' }),
        buildDelivery({ id: 'd2' }),
      ]);

      await service.processDueDeliveries();

      expect(deliveryRepository.save).toHaveBeenCalledTimes(2);
    });

    it('keeps processing other deliveries when one throws', async () => {
      endpointRepository.findOne.mockImplementation(async () => {
        throw new Error('boom');
      });
      (global as any).fetch = jest.fn();
      deliveryRepository.find.mockResolvedValue([buildDelivery({ id: 'd1' })]);

      await expect(service.processDueDeliveries()).resolves.toBeUndefined();
    });
  });
});
