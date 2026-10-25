import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull } from 'typeorm';
import { createHmac } from 'crypto';
import { lookup } from 'dns/promises';
import { IntegrationDelivery } from '../entities/integration-delivery.entity';
import { IntegrationEndpoint } from '../entities/integration-endpoint.entity';

/**
 * Cron expression for the delivery worker.
 *
 * Deliveries are short-lived HTTP calls, so the worker ticks every minute.
 * The tick is cheap when the queue is empty (a single indexed lookup).
 */
const DELIVERY_CRON_EXPRESSION =
  process.env.INTEGRATION_DELIVERY_CRON_EXPRESSION?.trim() || '* * * * *';

/** How many times a delivery is attempted before it is marked FAILED. */
const MAX_ATTEMPTS = 6;

/** Base for the exponential backoff between retries. */
const RETRY_BASE_DELAY_MS = 60_000;

/** Upper bound on the backoff delay between retries. */
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;

/** How long to wait for the endpoint to respond. */
const REQUEST_TIMEOUT_MS = 15_000;

/** How much of the endpoint response body is kept for debugging. */
const MAX_RESPONSE_BODY_LENGTH = 2_000;

interface DeliveryAttemptResult {
  ok: boolean;
  status: number | null;
  body: string | null;
  error: string | null;
  /** Set when the failure was our fault (bad URL, blocked host) rather than the endpoint's. */
  permanent: boolean;
}

/**
 * IntegrationDeliveryWorkerService
 *
 * Delivers queued integration events to the organization's webhook endpoints.
 *
 * Without this service, `integration_deliveries` rows are written and then sit
 * there forever — the endpoint CRUD exists and events are queued, but nothing
 * ever leaves the application, which is the entire point of the feature.
 *
 * Delivery contract:
 *   - Each event is POSTed as JSON to the endpoint's `target` URL.
 *   - The body is signed with the endpoint's secret using HMAC-SHA256:
 *       X-Payforms-Signature: t=<unix seconds>,v1=<hex hmac>
 *     where the signed message is `${timestamp}.${rawBody}`. Receivers should
 *     compute the HMAC over the same string and compare.
 *   - `X-Payforms-Event` carries the event type, `X-Payforms-Delivery` the
 *     delivery id, so receivers can deduplicate.
 *
 * Retry behaviour:
 *   - A 2xx response marks the delivery DELIVERED.
 *   - Any other outcome is retried with exponential backoff
 *     (1m, 2m, 4m, 8m, 16m, ... capped at 1h) up to MAX_ATTEMPTS.
 *   - After the final attempt the delivery is marked FAILED and stays visible
 *     in the deliveries list for manual inspection.
 *   - 4xx responses other than 408/429 are treated as permanent failures: the
 *     endpoint rejected the request, and repeating it would not help.
 *
 * Safety:
 *   - Targets must be HTTPS and must not resolve to a private/loopback
 *     address. This blocks SSRF against internal infrastructure and cloud
 *     metadata endpoints.
 */
@Injectable()
export class IntegrationDeliveryWorkerService {
  private readonly logger = new Logger(IntegrationDeliveryWorkerService.name);

  /** Prevents overlapping passes from delivering the same row twice. */
  private running = false;

  constructor(
    @InjectRepository(IntegrationDelivery)
    private readonly deliveryRepository: Repository<IntegrationDelivery>,
    @InjectRepository(IntegrationEndpoint)
    private readonly endpointRepository: Repository<IntegrationEndpoint>,
  ) {}

  /**
   * Minute tick. Delivers every delivery that is due.
   */
  @Cron(DELIVERY_CRON_EXPRESSION, { name: 'integration-delivery-worker' })
  async processDueDeliveries(): Promise<void> {
    if (this.running) {
      this.logger.warn(
        'Integration delivery worker: previous pass still running, skipping this tick',
      );
      return;
    }

    this.running = true;
    try {
      await this.runPass();
    } catch (error) {
      this.logger.error(
        'Integration delivery worker: pass failed',
        error instanceof Error ? error.message : error,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Deliver a single delivery row immediately, regardless of its schedule.
   * Used by the manual "retry now" endpoint.
   */
  async deliverNow(delivery: IntegrationDelivery): Promise<DeliveryAttemptResult> {
    const endpoint = await this.endpointRepository.findOne({
      where: { id: delivery.endpoint_id },
    });

    if (!endpoint) {
      return {
        ok: false,
        status: null,
        body: null,
        error: 'Endpoint no longer exists',
        permanent: true,
      };
    }

    if (!endpoint.active) {
      return {
        ok: false,
        status: null,
        body: null,
        error: 'Endpoint is inactive',
        permanent: true,
      };
    }

    const result = await this.attemptDelivery(endpoint, delivery);
    await this.applyResult(delivery, result);
    return result;
  }

  private async runPass(): Promise<void> {
    const now = new Date();

    const due = await this.deliveryRepository.find({
      where: [
        {
          status: 'QUEUED',
          next_attempt_at: IsNull(),
        },
        {
          status: 'QUEUED',
          next_attempt_at: LessThanOrEqual(now),
        },
      ],
      order: { created_at: 'ASC' },
      take: 100,
    });

    if (!due.length) {
      this.logger.debug('Integration delivery worker: no deliveries due');
      return;
    }

    this.logger.log(`Integration delivery worker: processing ${due.length} delivery(ies)`);

    for (const delivery of due) {
      try {
        await this.deliverNow(delivery);
      } catch (error) {
        // A failure here must not stop the remaining deliveries.
        this.logger.error(
          `Integration delivery worker: delivery ${delivery.id} threw`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  /**
   * Perform the HTTP POST for one delivery.
   */
  private async attemptDelivery(
    endpoint: IntegrationEndpoint,
    delivery: IntegrationDelivery,
  ): Promise<DeliveryAttemptResult> {
    if (!delivery.payload) {
      return {
        ok: false,
        status: null,
        body: null,
        error: 'Delivery has no stored payload and cannot be delivered',
        permanent: true,
      };
    }

    let target: URL;
    try {
      target = await this.assertSafeTarget(endpoint.target);
    } catch (error) {
      return {
        ok: false,
        status: null,
        body: null,
        error: error instanceof Error ? error.message : 'Endpoint target is not usable',
        permanent: true,
      };
    }

    const body = JSON.stringify({
      id: delivery.id,
      event: delivery.event_type,
      created_at: delivery.created_at,
      data: delivery.payload,
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.signPayload(endpoint.secret, timestamp, body);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(target.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Payforms-Webhooks/1.0',
          'X-Payforms-Event': delivery.event_type,
          'X-Payforms-Delivery': delivery.id,
          'X-Payforms-Signature': `t=${timestamp},v1=${signature}`,
        },
        body,
        signal: controller.signal,
      });

      const responseText = await response.text().catch(() => '');

      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          body: responseText.slice(0, MAX_RESPONSE_BODY_LENGTH),
          error: null,
          permanent: false,
        };
      }

      return {
        ok: false,
        status: response.status,
        body: responseText.slice(0, MAX_RESPONSE_BODY_LENGTH),
        error: `Endpoint responded with ${response.status}`,
        // 408 (timeout) and 429 (rate limited) are worth retrying; other 4xx
        // responses mean the request itself was rejected.
        permanent: response.status >= 400 && response.status < 500 &&
          response.status !== 408 && response.status !== 429,
      };
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      return {
        ok: false,
        status: null,
        body: null,
        error: aborted
          ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : 'Request failed',
        permanent: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Record the outcome of an attempt on the delivery row.
   */
  private async applyResult(
    delivery: IntegrationDelivery,
    result: DeliveryAttemptResult,
  ): Promise<void> {
    delivery.attempts = (delivery.attempts ?? 0) + 1;
    delivery.last_attempt_at = new Date();
    delivery.response_status = result.status;
    delivery.response_body = result.body;
    delivery.last_error = result.error;

    if (result.ok) {
      delivery.status = 'DELIVERED';
      delivery.delivered_at = new Date();
      delivery.next_attempt_at = null;
    } else if (result.permanent || delivery.attempts >= MAX_ATTEMPTS) {
      delivery.status = 'FAILED';
      delivery.next_attempt_at = null;
    } else {
      delivery.status = 'QUEUED';
      delivery.next_attempt_at = new Date(Date.now() + this.backoffDelay(delivery.attempts));
    }

    await this.deliveryRepository.save(delivery);

    if (result.ok) {
      this.logger.log(
        `Integration delivery worker: delivered ${delivery.id} (${delivery.event_type})`,
      );
    } else if (delivery.status === 'FAILED') {
      this.logger.warn(
        `Integration delivery worker: gave up on ${delivery.id} (${delivery.event_type}) — ${result.error}`,
      );
    } else {
      this.logger.warn(
        `Integration delivery worker: retry ${delivery.attempts}/${MAX_ATTEMPTS} for ${delivery.id} — ${result.error}`,
      );
    }
  }

  /**
   * Exponential backoff: 1m, 2m, 4m, ... capped at 1 hour.
   */
  private backoffDelay(attempts: number): number {
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, Math.max(0, attempts - 1));
    return Math.min(delay, MAX_RETRY_DELAY_MS);
  }

  /**
   * Sign the request body with the endpoint secret.
   *
   * The signed message is `${timestamp}.${rawBody}` so that a captured
   * signature cannot be replayed against a different body or timestamp.
   */
  private signPayload(secret: string, timestamp: number, body: string): string {
    return createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');
  }

  /**
   * Validate the endpoint target before sending anything to it.
   *
   * Guards against SSRF: a tenant that can register an integration endpoint
   * could otherwise point it at internal services (cloud metadata endpoints,
   * private RFC1918 ranges, the loopback interface) and have the platform
   * request them on their behalf.
   */
  private async assertSafeTarget(target: string): Promise<URL> {
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      throw new Error('Endpoint target is not a valid URL');
    }

    if (url.protocol !== 'https:') {
      throw new Error('Endpoint target must use HTTPS');
    }

    if (url.username || url.password) {
      throw new Error('Endpoint target must not embed credentials');
    }

    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(url.hostname, { all: true });
    } catch {
      throw new Error('Endpoint target hostname could not be resolved');
    }

    for (const entry of addresses) {
      if (this.isPrivateAddress(entry.address)) {
        throw new Error('Endpoint target resolves to a private or reserved address');
      }
    }

    return url;
  }

  /**
   * True when an address is loopback, private, link-local, or otherwise
   * reserved — i.e. not a public internet address.
   */
  private isPrivateAddress(address: string): boolean {
    const value = address.toLowerCase().split('%')[0];

    // IPv4-mapped IPv6 (::ffff:127.0.0.1) — unwrap and re-check as IPv4.
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) {
      return this.isPrivateAddress(mapped[1]);
    }

    if (value === '::1' || value === '::') {
      return true;
    }

    // Unique local (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd][0-9a-f]{2}:/.test(value)) {
      return true;
    }
    if (/^fe[89ab][0-9a-f]:/.test(value)) {
      return true;
    }

    const ipv4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4) {
      // Not an IP literal we recognise — could not be a private address we
      // can detect, so let it through.
      return false;
    }

    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];

    if (a === 0 || a === 10 || a === 127) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    if (a === 169 && b === 254) {
      return true;
    }
    if (a === 100 && b >= 64 && b <= 127) {
      // Carrier-grade NAT.
      return true;
    }
    if (a >= 224) {
      // Multicast and reserved.
      return true;
    }

    return false;
  }
}
