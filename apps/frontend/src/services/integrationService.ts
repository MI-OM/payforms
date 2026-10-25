import { apiClient } from './api';

export type IntegrationEndpointType = 'WEBHOOK' | 'SHEETS';

export interface IntegrationEndpoint {
  id: string;
  organization_id: string;
  type: IntegrationEndpointType;
  target: string;
  name: string | null;
  /** Event types this endpoint subscribes to. Empty means all events. */
  events: string[];
  active: boolean;
  config: Record<string, unknown> | null;
  /** The secret is never returned in full — only a masked preview. */
  secret_preview?: string;
  created_at: string;
  updated_at: string;
}

/** The events an endpoint can subscribe to. */
export const INTEGRATION_EVENTS = [
  'payment.completed',
  'payment.failed',
  'submission.created',
  'contact.created',
  'market.reconciliation.run.completed',
  'market.recovery.run.completed',
  'market.compliance.export_pack.ready',
  'market.compliance.export_pack.failed',
  'dunning_run_created',
] as const;

export type IntegrationDeliveryStatus = 'QUEUED' | 'DELIVERED' | 'FAILED';

export interface IntegrationDelivery {
  id: string;
  organization_id: string;
  endpoint_id: string;
  event_type: string;
  status: IntegrationDeliveryStatus;
  attempts: number;
  last_error: string | null;
  response_status: number | null;
  response_body: string | null;
  delivered_at: string | null;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  created_at: string;
}

export interface IntegrationDeliveryPage {
  data: IntegrationDelivery[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateIntegrationEndpointDto {
  type: IntegrationEndpointType;
  target: string;
  name?: string;
  events?: string[];
  secret?: string;
  active?: boolean;
  config?: Record<string, unknown>;
}

export interface UpdateIntegrationEndpointDto {
  target?: string;
  name?: string;
  events?: string[];
  secret?: string;
  active?: boolean;
  config?: Record<string, unknown>;
}

export interface IntegrationEndpointStats {
  endpoint_id: string;
  total_deliveries: number;
  successful: number;
  failed: number;
  queued: number;
  success_rate: number;
}

export interface DeliveryAttemptResult {
  delivery_id: string;
  status: IntegrationDeliveryStatus;
  ok: boolean;
  response_status: number | null;
  response_body?: string | null;
  error: string | null;
}

class IntegrationService {
  /**
   * List the organization's integration endpoints.
   */
  async listEndpoints(): Promise<IntegrationEndpoint[]> {
    return apiClient.get('/v1/market/integrations/endpoints');
  }

  /**
   * Register a new integration endpoint.
   */
  async createEndpoint(dto: CreateIntegrationEndpointDto): Promise<IntegrationEndpoint> {
    return apiClient.post('/v1/market/integrations/endpoints', dto);
  }

  /**
   * Get a single endpoint.
   */
  async getEndpoint(endpointId: string): Promise<IntegrationEndpoint> {
    return apiClient.get(`/v1/market/integrations/endpoints/${endpointId}`);
  }

  /**
   * Update an endpoint's target, name, event list, secret, or active state.
   */
  async updateEndpoint(
    endpointId: string,
    dto: UpdateIntegrationEndpointDto,
  ): Promise<IntegrationEndpoint> {
    return apiClient.patch(`/v1/market/integrations/endpoints/${endpointId}`, dto);
  }

  /**
   * Pause or resume an endpoint.
   */
  async toggleEndpoint(endpointId: string): Promise<IntegrationEndpoint & { is_enabled: boolean }> {
    return apiClient.post(`/v1/market/integrations/endpoints/${endpointId}/toggle`);
  }

  /**
   * Delete an endpoint. Its delivery history is kept.
   */
  async deleteEndpoint(endpointId: string): Promise<void> {
    return apiClient.delete(`/v1/market/integrations/endpoints/${endpointId}`);
  }

  /**
   * Delivery statistics for an endpoint.
   */
  async getEndpointStats(endpointId: string): Promise<IntegrationEndpointStats> {
    return apiClient.get(`/v1/market/integrations/endpoints/${endpointId}/stats`);
  }

  /**
   * List recent deliveries, newest first.
   */
  async listDeliveries(
    page = 1,
    limit = 20,
    endpointId?: string,
    status?: string,
  ): Promise<IntegrationDeliveryPage> {
    return apiClient.get('/v1/market/integrations/deliveries', {
      page,
      limit,
      endpoint_id: endpointId,
      status,
    });
  }

  /**
   * Get a single delivery record.
   */
  async getDelivery(deliveryId: string): Promise<IntegrationDelivery> {
    return apiClient.get(`/v1/market/integrations/deliveries/${deliveryId}`);
  }

  /**
   * Send a test event to an endpoint and attempt delivery immediately.
   */
  async testEndpoint(endpointId: string): Promise<DeliveryAttemptResult> {
    return apiClient.post(`/v1/market/integrations/endpoints/${endpointId}/test`);
  }

  /**
   * Attempt a failed delivery again, right now.
   */
  async retryDelivery(deliveryId: string): Promise<DeliveryAttemptResult> {
    return apiClient.post(`/v1/market/integrations/deliveries/${deliveryId}/retry`);
  }

  /**
   * Whether the integrations feature is enabled for the organization.
   */
  async isEnabled(): Promise<boolean> {
    const flags = await apiClient.get('/v1/market/features');
    return Boolean(flags?.integrations_enabled);
  }
}

export const integrationService = new IntegrationService();
