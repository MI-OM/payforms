import { useCallback, useEffect, useState } from 'react';
import {
  integrationService,
  INTEGRATION_EVENTS,
  type IntegrationDelivery,
  type IntegrationEndpoint,
} from '@/services/integrationService';
import {
  AlertCircle,
  Plus,
  Webhook,
  RefreshCw,
  Send,
  Trash2,
  Play,
  Power,
  BarChart3,
} from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  DELIVERED: 'bg-green-100 text-green-800',
  QUEUED: 'bg-blue-100 text-blue-800',
  FAILED: 'bg-red-100 text-red-800',
};

export default function IntegrationsPage() {
  const [endpoints, setEndpoints] = useState<IntegrationEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<IntegrationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const [busyEndpointId, setBusyEndpointId] = useState<string | null>(null);
  const [busyDeliveryId, setBusyDeliveryId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, { total: number; successRate: number }>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [endpointList, deliveryPage] = await Promise.all([
        integrationService.listEndpoints(),
        integrationService.listDeliveries(1, 20),
      ]);
      setEndpoints(endpointList || []);
      setDeliveries(deliveryPage?.data || []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!target.trim()) {
      setError('A target URL is required');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      await integrationService.createEndpoint({
        type: 'WEBHOOK',
        target: target.trim(),
        name: name.trim() || undefined,
        events,
        secret: secret.trim() || undefined,
      });
      setName('');
      setTarget('');
      setSecret('');
      setEvents([]);
      setShowCreate(false);
      setNotice('Endpoint created. Use "Send test" to verify it is reachable.');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create endpoint');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (endpointId: string) => {
    try {
      setBusyEndpointId(endpointId);
      setError(null);
      await integrationService.deleteEndpoint(endpointId);
      setDeleteConfirm(null);
      setNotice('Endpoint deleted.');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete endpoint');
    } finally {
      setBusyEndpointId(null);
    }
  };

  const handleShowStats = async (endpointId: string) => {
    try {
      setBusyEndpointId(endpointId);
      const result = await integrationService.getEndpointStats(endpointId);
      setStats((current) => ({
        ...current,
        [endpointId]: {
          total: result.total_deliveries,
          successRate: result.success_rate,
        },
      }));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load endpoint statistics');
    } finally {
      setBusyEndpointId(null);
    }
  };

  const toggleEvent = (event: string) => {
    setEvents((current) =>
      current.includes(event) ? current.filter((e) => e !== event) : [...current, event],
    );
  };

  const handleTest = async (endpointId: string) => {
    try {
      setBusyEndpointId(endpointId);
      setError(null);
      const result = await integrationService.testEndpoint(endpointId);
      if (result.ok) {
        setNotice(`Test delivered (HTTP ${result.response_status}).`);
      } else {
        setError(result.error || 'Test delivery failed');
      }
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send test event');
    } finally {
      setBusyEndpointId(null);
    }
  };

  const handleToggle = async (endpoint: IntegrationEndpoint) => {
    try {
      setBusyEndpointId(endpoint.id);
      setError(null);
      await integrationService.toggleEndpoint(endpoint.id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update endpoint');
    } finally {
      setBusyEndpointId(null);
    }
  };

  const handleRetry = async (deliveryId: string) => {
    try {
      setBusyDeliveryId(deliveryId);
      setError(null);
      const result = await integrationService.retryDelivery(deliveryId);
      if (result.ok) {
        setNotice('Delivery retried successfully.');
      } else {
        setError(result.error || 'Retry failed');
      }
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to retry delivery');
    } finally {
      setBusyDeliveryId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Integrations &amp; Webhooks</h1>
            <p className="mt-2 text-gray-600">
              Send events to your own systems over HTTPS. Every request is signed with your
              endpoint secret.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              className="inline-flex items-center gap-2 border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={() => setShowCreate((value) => !value)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              Add Endpoint
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {notice && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">{notice}</p>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">New webhook endpoint</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Finance system"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target URL
                </label>
                <input
                  type="url"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="https://example.com/hooks/payforms"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Must be HTTPS and must not point at a private network.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Signing secret
                </label>
                <input
                  type="text"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Leave blank to generate one"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Used to sign the X-Payforms-Signature header.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Events
                </label>
                <div className="border border-gray-300 rounded-lg p-3 space-y-1.5 max-h-44 overflow-y-auto">
                  {INTEGRATION_EVENTS.map((event) => (
                    <label
                      key={event}
                      className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-mono text-xs">{event}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Leave all unchecked to receive every event.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Endpoint'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-600">Loading integrations...</p>
          </div>
        ) : (
          <>
            {/* Endpoints */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Endpoints</h2>

              {endpoints.length === 0 ? (
                <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
                  <Webhook className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No endpoints yet</h3>
                  <p className="text-gray-600 mb-6">
                    Add a webhook URL to receive payment and submission events.
                  </p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    <Plus className="h-4 w-4" />
                    Add Endpoint
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {endpoints.map((endpoint) => (
                    <div
                      key={endpoint.id}
                      className="bg-white rounded-lg shadow border border-gray-200 p-6"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <Webhook className="h-4 w-4 text-gray-500" />
                            {endpoint.name && (
                              <span className="font-semibold text-gray-900">
                                {endpoint.name}
                              </span>
                            )}
                            <span className="font-mono text-sm text-gray-600 truncate">
                              {endpoint.target}
                            </span>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                endpoint.active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {endpoint.active ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Type {endpoint.type}
                            {endpoint.secret_preview ? ` • secret ${endpoint.secret_preview}` : ''}
                            {' • '}
                            {endpoint.events?.length
                              ? `events: ${endpoint.events.join(', ')}`
                              : 'receives all events'}
                          </p>
                          {stats[endpoint.id] && (
                            <p className="text-xs text-gray-600 mt-1 inline-flex items-center gap-1">
                              <BarChart3 className="h-3 w-3" />
                              {stats[endpoint.id].total} deliveries •{' '}
                              {stats[endpoint.id].successRate}% success rate
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleTest(endpoint.id)}
                            disabled={busyEndpointId === endpoint.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50"
                          >
                            {busyEndpointId === endpoint.id ? (
                              <div className="h-3.5 w-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin"></div>
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            Send test
                          </button>
                          <button
                            onClick={() => handleShowStats(endpoint.id)}
                            disabled={busyEndpointId === endpoint.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50"
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                            Stats
                          </button>
                          <button
                            onClick={() => handleToggle(endpoint)}
                            disabled={busyEndpointId === endpoint.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50"
                          >
                            <Power className="h-3.5 w-3.5" />
                            {endpoint.active ? 'Pause' : 'Activate'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(endpoint.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete endpoint"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {deleteConfirm === endpoint.id && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
                          <p className="text-sm text-red-800">
                            Delete this endpoint? Its delivery history is kept, but no new
                            events will be sent to it.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(endpoint.id)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Deliveries */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Recent deliveries</h2>

              {deliveries.length === 0 ? (
                <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
                  <Trash2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No deliveries have been queued yet.</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Event
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Attempts
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Response
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Queued
                        </th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {deliveries.map((delivery) => (
                        <tr key={delivery.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">
                            {delivery.event_type}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                STATUS_STYLES[delivery.status] || 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {delivery.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{delivery.attempts}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {delivery.response_status ?? '—'}
                            {delivery.last_error && (
                              <span className="block text-xs text-red-600">{delivery.last_error}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(delivery.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {delivery.status !== 'DELIVERED' && (
                              <button
                                onClick={() => handleRetry(delivery.id)}
                                disabled={busyDeliveryId === delivery.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50"
                              >
                                {busyDeliveryId === delivery.id ? (
                                  <div className="h-3.5 w-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin"></div>
                                ) : (
                                  <Play className="h-3.5 w-3.5" />
                                )}
                                Retry
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
