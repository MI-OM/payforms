import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { reminderAutomationService, type ReminderSendHistory } from '@/services/reminderAutomationService';
import { ArrowLeft, AlertCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function ReminderHistoryPage() {
  const searchParams = useSearchParams();
  const contactId = searchParams?.get('contact_id');

  const [history, setHistory] = useState<ReminderSendHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (contactId) {
      loadHistory();
    }
  }, [contactId]);

  const loadHistory = async () => {
    if (!contactId) return;
    try {
      setLoading(true);
      const data = await reminderAutomationService.getContactHistory(contactId, 50);
      setHistory(data || []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load history');
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'bounced':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'bounced':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!contactId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Contact Selected</h3>
            <p className="text-gray-600 mb-6">
              Please select a contact to view reminder history
            </p>
            <Link
              href="/dashboard/contacts"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Contacts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard/contacts"
            className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reminder History</h1>
            <p className="text-gray-600">View all reminders sent to this contact</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-600">Loading history...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && history.length === 0 && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No History</h3>
            <p className="text-gray-600">
              No reminders have been sent to this contact yet
            </p>
          </div>
        )}

        {/* History List */}
        {!loading && history.length > 0 && (
          <div className="space-y-3">
            {history.map(record => (
              <div
                key={record.id}
                className="bg-white rounded-lg shadow border border-gray-200 hover:shadow-lg transition"
              >
                {/* Header */}
                <button
                  onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {getStatusIcon(record.send_status)}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-semibold text-gray-900">
                          {record.recipient_email}
                        </p>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(
                            record.send_status,
                          )}`}
                        >
                          {record.send_status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {new Date(record.sent_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    <svg
                      className={`h-5 w-5 transition-transform ${
                        expandedId === record.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedId === record.id && (
                  <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                    {/* Message */}
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                        Message Sent:
                      </p>
                      <div className="p-3 bg-white border border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                          {record.message_sent}
                        </p>
                      </div>
                    </div>

                    {/* Balance & Status Info */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {record.balance_due_at_send !== null &&
                        record.balance_due_at_send !== undefined && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              Balance Due
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              ₦{record.balance_due_at_send.toLocaleString()}
                            </p>
                          </div>
                        )}
                      {record.days_overdue_at_send !== null &&
                        record.days_overdue_at_send !== undefined && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Days Overdue
                          </p>
                          <p className="text-lg font-semibold text-gray-900">
                            {record.days_overdue_at_send} days
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Error Message */}
                    {record.error_message && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">
                          Error:
                        </p>
                        <p className="text-sm text-red-700 mt-1">{record.error_message}</p>
                      </div>
                    )}

                    {/* Additional Info */}
                    <div className="mt-4 pt-4 border-t border-gray-300 space-y-2 text-xs text-gray-600">
                      <p>
                        <strong>Policy ID:</strong> {record.policy_id}
                      </p>
                      <p>
                        <strong>Sent At:</strong> {new Date(record.sent_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
