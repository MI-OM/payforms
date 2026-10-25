import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { installmentService, type DunningCampaign, type DunningRun, type ArrearsSnapshot } from '@/services/installmentService';

const RUN_STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export default function CampaignRunsPage() {
  const router = useRouter();
  const { id: campaignId } = router.query;

  const [campaign, setCampaign] = useState<DunningCampaign | null>(null);
  const [runs, setRuns] = useState<DunningRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<DunningRun | null>(null);
  const [snapshots, setSnapshots] = useState<ArrearsSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (campaignId) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function load() {
    try {
      setLoading(true);
      const [c, r] = await Promise.all([
        installmentService.getCampaign(campaignId as string),
        installmentService.listRuns(campaignId as string),
      ]);
      setCampaign(c);
      setRuns(r ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function triggerRun(dryRun = false) {
    try {
      setRunning(true);
      await installmentService.runCampaign(campaignId as string, { dry_run: dryRun });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to run campaign');
    } finally {
      setRunning(false);
    }
  }

  async function viewSnapshots(run: DunningRun) {
    if (selectedRun?.id === run.id) {
      setSelectedRun(null);
      setSnapshots([]);
      return;
    }
    try {
      setLoadingSnapshots(true);
      setSelectedRun(run);
      const s = await installmentService.listSnapshots(run.id);
      setSnapshots(s ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load snapshots');
    } finally {
      setLoadingSnapshots(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/installments/campaigns" className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{campaign?.name}</h1>
            <p className="text-sm text-gray-500">{runs.length} runs · {campaign?.execution_frequency}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => triggerRun(true)}
              disabled={running}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
            >
              Dry Run
            </button>
            <button
              onClick={() => triggerRun(false)}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition disabled:opacity-50"
            >
              {running && <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Run Campaign
            </button>
          </div>
        </div>

        {/* Error */}
        {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>}

        {/* Empty */}
        {runs.length === 0 && (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-16 text-center">
            <p className="text-gray-500 mb-2">No runs yet</p>
            <p className="text-sm text-gray-400">Click "Run Campaign" to execute the first run</p>
          </div>
        )}

        {/* Runs list */}
        {runs.length > 0 && (
          <div className="space-y-3">
            {runs.map(run => (
              <div key={run.id} className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
                {/* Run summary row */}
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => viewSnapshots(run)}
                >
                  <div className="flex-1 grid grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                      <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${RUN_STATUS_STYLES[run.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {run.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Contacts</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{run.contacts_evaluated}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Outstanding</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{Number(run.total_outstanding).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Scheduled</p>
                      <p className="text-sm text-gray-700 mt-1">
                        {run.scheduled_for ? new Date(run.scheduled_for).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Completed</p>
                      <p className="text-sm text-gray-700 mt-1">
                        {run.completed_at ? new Date(run.completed_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${selectedRun?.id === run.id ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Snapshots panel */}
                {selectedRun?.id === run.id && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {loadingSnapshots ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
                      </div>
                    ) : snapshots.length === 0 ? (
                      <p className="text-center text-gray-400 py-8 text-sm">No arrears snapshots for this run</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Contact</th>
                              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Outstanding</th>
                              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Days Overdue</th>
                              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Stage</th>
                              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {snapshots.map(s => (
                              <tr key={s.id} className="hover:bg-white">
                                <td className="px-6 py-3">
                                  {s.contact ? (
                                    <div>
                                      <p className="font-medium text-gray-900">{s.contact.first_name} {s.contact.last_name}</p>
                                      <p className="text-xs text-gray-400">{s.contact.email}</p>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-xs">{s.contact_id.slice(0, 8)}…</span>
                                  )}
                                </td>
                                <td className="px-6 py-3 font-semibold text-gray-900">{Number(s.outstanding_amount).toLocaleString()}</td>
                                <td className="px-6 py-3 text-gray-700">{s.days_overdue}d</td>
                                <td className="px-6 py-3 text-gray-700">{s.current_stage}</td>
                                <td className="px-6 py-3">
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{s.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
