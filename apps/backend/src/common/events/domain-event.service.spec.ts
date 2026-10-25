import { DomainEventService } from './domain-event.service';

describe('DomainEventService', () => {
  let service: DomainEventService;

  beforeEach(() => {
    service = new DomainEventService();
  });

  it('passes the event to a subscriber of that type', async () => {
    const handler = jest.fn();
    service.on('payment.completed', handler);

    await service.emit('payment.completed', 'org-1', { reference: 'ref-1' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      type: 'payment.completed',
      organization_id: 'org-1',
      payload: { reference: 'ref-1' },
    });
  });

  it('does not deliver an event to subscribers of another type', async () => {
    const handler = jest.fn();
    service.on('payment.failed', handler);

    await service.emit('payment.completed', 'org-1', {});

    expect(handler).not.toHaveBeenCalled();
  });

  it('delivers to every subscriber of the same type', async () => {
    const first = jest.fn();
    const second = jest.fn();
    service.on('submission.created', first);
    service.on('submission.created', second);

    await service.emit('submission.created', 'org-1', {});

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stamps the event with an occurrence time', async () => {
    const handler = jest.fn();
    service.on('contact.created', handler);

    await service.emit('contact.created', 'org-1', {});

    expect(handler.mock.calls[0][0].occurred_at).toBeInstanceOf(Date);
  });

  it('does not fail the publisher when a subscriber throws', async () => {
    const failing = jest.fn().mockImplementation(() => {
      throw new Error('subscriber exploded');
    });
    const healthy = jest.fn();
    service.on('payment.completed', failing);
    service.on('payment.completed', healthy);

    await expect(
      service.emit('payment.completed', 'org-1', {}),
    ).resolves.toBeUndefined();

    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it('does not fail the publisher when a subscriber rejects', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('async explosion'));
    service.on('payment.completed', failing);

    await expect(
      service.emit('payment.completed', 'org-1', {}),
    ).resolves.toBeUndefined();
  });
});
