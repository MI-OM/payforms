import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  reminderAutomationService,
  type ReminderPolicy,
} from '@/services/reminderAutomationService';
import { AlertCircle, Plus, Edit, Trash2, ToggleLeft, ToggleRight, Clock, Users, Play } from 'lucide-react';

export default function RemindersPage() {
  const [policies, setPolicies] = useState<ReminderPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [updatingToggle, setUpdatingToggle] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ sent: number; failed: number } | null>(null);

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const data = await reminderAutomationService.listPolicies();
      setPolicies(data || []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load policies');
      console.error('Error loading policies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (policyId: string, isEnabled: boolean) => {
    try {
      setUpdatingToggle(policyId);
      const updated = await reminderAutomationService.togglePolicy(policyId, !isEnabled);
      setPolicies(policies.map(p => (p.id === policyId ? updated : p)));
    } catch (err: any) {
      console.error('Error toggling policy:', err);
      alert(err?.response?.data?.message || 'Failed to update policy');
    } finally {
      setUpdatingToggle(null);
    }
  };

  const handleDelete = async (policyId: string) => {
    try {
      await reminderAutomationService.deletePolicy(policyId);
      setPolicies(policies.filter(p => p.id !== policyId));
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error('Error deleting policy:', err);
      alert(err?.response?.data?.message || 'Failed to delete policy');
    }
  };

  const handleRunNow = async () => {
    try {
      setRunning(true);
      setRunResult(null);
      const result = await reminderAutomationService.runPoliciesNow();
      setRunResult(result);
      // Policies that just fired have a new last_executed_at.
      await loadPolicies();
    } catch (err: any) {
      console.error('Error running reminder policies:', err);
      setError(err?.response?.data?.message || 'Failed to run reminder policies');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Automated Reminders</h1>
            <p className="mt-2 text-gray-600">
              Configure automatic payment reminders based on outstanding balance and overdue days
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRunNow}
              disabled={running || policies.length === 0}
              className="inline-flex items-center gap-2 border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Evaluate every enabled policy now, instead of waiting for the next scheduled run"
            >
              {running ? (
                <div className="h-4 w-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin"></div>
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run Now
            </button>
            <Link
              href="/dashboard/reminders/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              New Policy
            </Link>
          </div>
        </div>

        {/* Run Result */}
        {runResult && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              Sent <span className="font-semibold">{runResult.sent}</span> reminder
              {runResult.sent === 1 ? '' : 's'}
              {runResult.failed > 0 && (
                <>
                  {' '}and failed{' '}
                  <span className="font-semibold">{runResult.failed}</span>.
                </>
              )}
            </p>
          </div>
        )}

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
            <p className="mt-4 text-gray-600">Loading policies...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && policies.length === 0 && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Policies Yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first automated reminder policy to get started
            </p>
            <Link
              href="/dashboard/reminders/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              Create Policy
            </Link>
          </div>
        )}

        {/* Policies List */}
        {!loading && policies.length > 0 && (
          <div className="grid gap-4">
            {policies.map(policy => (
              <div
                key={policy.id}
                className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-lg transition"
              >
                {/* Policy Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{policy.name}</h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          policy.is_enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {policy.is_enabled ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {policy.description && (
                      <p className="text-sm text-gray-600">{policy.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggle(policy.id, policy.is_enabled)}
                      disabled={updatingToggle === policy.id}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                      title={policy.is_enabled ? 'Disable' : 'Enable'}
                    >
                      {updatingToggle === policy.id ? (
                        <div className="h-5 w-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
                      ) : policy.is_enabled ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    <Link
                      href={`/dashboard/reminders/${policy.id}/edit`}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Edit"
                    >
                      <Edit className="h-5 w-5" />
                    </Link>
                    <button
                      onClick={() => setDeleteConfirm(policy.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation Modal */}
                {deleteConfirm === policy.id && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Policy</h3>
                      <p className="text-gray-600 mb-6">
                        Are you sure you want to delete the policy "{policy.name}"? This action cannot be undone.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(policy.id)}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Policy Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                  {/* Trigger Config */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Min. Balance Due
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      ₦{policy.trigger_config.balance_due_threshold.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Min. Days Overdue
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {policy.trigger_config.days_overdue_threshold} days
                    </p>
                  </div>

                  {/* Recipient Config */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Recipients
                    </p>
                    <p className="text-lg font-semibold text-gray-900 flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {policy.recipient_config.type === 'all_with_balance_due'
                        ? 'All'
                        : `${policy.recipient_config.group_ids?.length || 0} groups`}
                    </p>
                  </div>

                  {/* Cooldown */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                      Cooldown
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {policy.cooldown_days} days
                    </p>
                  </div>
                </div>

                {/* Message Preview */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                    Message Template
                  </p>
                  <p className="text-sm text-gray-700 line-clamp-3">{policy.message_template}</p>
                </div>

                {/* Last Executed */}
                {policy.last_executed_at && (
                  <p className="text-xs text-gray-500 mt-3">
                    Last executed: {new Date(policy.last_executed_at).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
