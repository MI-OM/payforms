import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { EventEmitter } from 'events';

/**
 * Domain event types published by the application.
 *
 * These are the events an organization can subscribe to through the
 * integrations (webhook) feature.
 */
export type DomainEventType =
  | 'payment.completed'
  | 'payment.failed'
  | 'submission.created'
  | 'contact.created';

export interface DomainEvent<TPayload = Record<string, unknown>> {
  type: DomainEventType;
  organization_id: string;
  payload: TPayload;
  occurred_at: Date;
}

/**
 * DomainEventService
 *
 * A tiny in-process publish/subscribe bus.
 *
 * It exists so that core modules (payments, submissions) can announce that
 * something happened without depending on the integrations module — and
 * without the integrations module having to be imported into the payment path.
 * The integrations module subscribes and turns events into webhook deliveries.
 *
 * Delivery guarantees:
 *   - `emit` awaits every subscriber, so a subscriber that queues work has
 *     finished queuing by the time `emit` resolves. Callers can therefore
 *     rely on the event having been recorded.
 *   - A subscriber that throws is logged and ignored. Publishing a domain
 *     event must never fail the business operation that produced it — a
 *     payment that succeeded cannot be undone because a webhook was
 *     misconfigured.
 */
@Injectable()
export class DomainEventService {
  private readonly emitter = new EventEmitter();
  private readonly logger = new Logger(DomainEventService.name);

  /**
   * Publish an event to all subscribers.
   */
  async emit<TPayload extends Record<string, unknown>>(
    type: DomainEventType,
    organizationId: string,
    payload: TPayload,
  ): Promise<void> {
    const event: DomainEvent<TPayload> = {
      type,
      organization_id: organizationId,
      payload,
      occurred_at: new Date(),
    };

    const handlers = this.emitter.listeners(type) as Array<
      (event: DomainEvent<TPayload>) => void | Promise<void>
    >;

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(
          `Domain event subscriber failed for ${type}`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  /**
   * Subscribe to an event type.
   */
  on<TPayload extends Record<string, unknown>>(
    type: DomainEventType,
    handler: (event: DomainEvent<TPayload>) => void | Promise<void>,
  ): void {
    this.emitter.on(type, handler as (event: DomainEvent) => void);
  }
}

@Global()
@Module({
  providers: [DomainEventService],
  exports: [DomainEventService],
})
export class DomainEventsModule {}
