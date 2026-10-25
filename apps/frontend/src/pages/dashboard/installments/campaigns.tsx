import { useState, useEffect } from 'react';
import Link from 'next/link';
import { installmentService, type DunningCampaign, type MarketFlags } from '@/services/installmentService';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  ARCHIVED: 'bg-gray-100 text-gray-400',
};

export default function DunningCampaignsPage() {
  const [campaigns, setCampaigns] = useState<DunningCampaign[]>([]);
  const [flags, setFlags] = useState<MarketFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const f = await installmentService.getFlags();
      setFlags(f);
      if (f.arrears_dunning_enabled) {
        const c = await installmentService.listCampaigns();
        setCampaigns(c ?? []);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function enable() {
    try {
      setEnabling(true);
      const f = await installmentService.enableDunning();
      setFlags(f);
      const c = await installmentService.listCampaigns();
      setCampaigns(c ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to enable');
    } finally {
      setEnabling(false);
    }
  }

  async function runCampaign(id: string) {
    try {
      setRunning(id);
      await installmentService.runCampaign(id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to run campaign');
    } finally {
      setRunning(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (flags && !flags.arrears_dunning_enabled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow border border-gray-200 p-10 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Arrears & Dunning</h2>
          <p className="text-gray-600 mb-8">
            Enable dunning campaigns to automatically follow up with contacts who have overdue payments.
          </p>
          <button
            onClick={enable}
            disabled={enabling}
            className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition disabled:opacity-50"
          >
            {enabling ? 'Enabling…' : 'Enable Dunning Campaigns'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/installments" className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Dunning Campaigns</h1>
            <p className="text-sm text-gray-500">Automated arrears follow-up campaigns</p>
          </div>
          <Link
            href="/dashboard/installments/campaigns/new"
            className="inline-flex items-center gap-2 bg-orange-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-orange-700 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Campaign
          </Link>
        </div>

        {/* Error */}
        {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>}

        {/* Empty */}
        {campaigns.length === 0 ? (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-16 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No campaigns yet</h3>
            <p className="text-gray-500 mb-6">Create your first dunning campaign to follow up on overdue payments</p>
            <Link href="/dashboard/installments/campaigns/new" className="inline-flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700 transition">
              Create Campaign
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {campaigns.map(campaign => (
              <div key={campaign.id} className="bg-white rounded-xl shadow border border-gray-200 p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[campaign.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {campaign.status}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="text-sm text-gray-500 mb-3">{campaign.description}</p>
                    )}
                    <div className="grid grid-cols-4 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Overdue Range</p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">{campaign.min_days_overdue}–{campaign.max_days_overdue} days</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Min Amount</p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">{Number(campaign.min_outstanding_amount).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Frequency</p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">{campaign.execution_frequency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Total Runs</p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">{campaign.total_runs}</p>
                      </div>
                    </div>
                    {campaign.last_executed_at && (
                      <p className="text-xs text-gray-400 mt-3">
                        Last run: {new Date(campaign.last_executed_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 ml-6">
                    <button
                      onClick={() => runCampaign(campaign.id)}
                      disabled={running === campaign.id}
                      className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {running === campaign.id ? (
                        <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      Run Now
                    </button>
                    <Link
                      href={`/dashboard/installments/campaigns/${campaign.id}/runs`}
                      className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-center"
                    >
                      History
                    </Link>
                    <Link
                      href={`/dashboard/installments/campaigns/${campaign.id}/edit`}
                      className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-center"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
