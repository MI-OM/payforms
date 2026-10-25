import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  reminderAutomationService,
  type ReminderPolicy,
  type ReminderTriggerConfig,
  type ReminderRecipientConfig,
} from '@/services/reminderAutomationService';
import { AlertCircle, ArrowLeft, Save, Loader } from 'lucide-react';

export default function EditReminderPage() {
  const router = useRouter();
  const { id } = router.query;
  const isNew = id === 'new';

  const [policy, setPolicy] = useState<Partial<ReminderPolicy>>({
    name: '',
    description: '',
    is_enabled: true,
    message_template: '',
    cooldown_days: 7,
    trigger_config: {
      balance_due_threshold: 1000,
      days_overdue_threshold: 3,
    },
    recipient_config: {
      type: 'all_with_balance_due',
      group_ids: [],
    },
  });

  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagePreview, setMessagePreview] = useState('');

  useEffect(() => {
    if (!isNew && id) {
      loadPolicy();
    }
    loadGroups();
  }, [id, isNew]);

  useEffect(() => {
    // Update message preview
    if (policy.message_template) {
      const preview = reminderAutomationService.getMessagePreview(
        policy.message_template,
        'John Doe',
        50000,
        7,
      );
      setMessagePreview(preview);
    }
  }, [policy.message_template]);

  const loadPolicy = async () => {
    try {
      setLoading(true);
      const data = await reminderAutomationService.getPolicy(id as string);
      setPolicy(data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load policy');
      console.error('Error loading policy:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await fetch('/api/groups', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setGroups(data || []);
      }
    } catch (err) {
      console.error('Error loading groups:', err);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setPolicy(prev => ({ ...prev, [field]: value }));
  };

  const handleTriggerChange = (field: keyof ReminderTriggerConfig, value: any) => {
    setPolicy(prev => ({
      ...prev,
      trigger_config: {
        ...(prev.trigger_config as ReminderTriggerConfig),
        [field]: value,
      },
    }));
  };

  const handleRecipientChange = (field: string, value: any) => {
    setPolicy(prev => ({
      ...prev,
      recipient_config: {
        ...(prev.recipient_config as ReminderRecipientConfig),
        [field]: value,
      },
    }));
  };

  const toggleGroup = (groupId: string) => {
    const currentGroups = (policy.recipient_config as ReminderRecipientConfig)?.group_ids || [];
    const newGroups = currentGroups.includes(groupId)
      ? currentGroups.filter(g => g !== groupId)
      : [...currentGroups, groupId];
    handleRecipientChange('group_ids', newGroups);
  };

  const handleSave = async () => {
    try {
      // Validation
      if (!policy.name?.trim()) {
        setError('Policy name is required');
        return;
      }
      if (!policy.message_template?.trim()) {
        setError('Message template is required');
        return;
      }
      if (
        (policy.trigger_config as ReminderTriggerConfig)?.balance_due_threshold < 0 ||
        (policy.trigger_config as ReminderTriggerConfig)?.days_overdue_threshold < 0
      ) {
        setError('Thresholds cannot be negative');
        return;
      }

      setSaving(true);
      if (isNew) {
        await reminderAutomationService.createPolicy(policy as any);
      } else {
        await reminderAutomationService.updatePolicy(id as string, policy as any);
      }
      await router.push('/dashboard/reminders');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save policy');
      console.error('Error saving policy:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block">
            <div className="h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-600">Loading policy...</p>
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
            href="/dashboard/reminders"
            className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isNew ? 'New Reminder Policy' : 'Edit Reminder Policy'}
            </h1>
            <p className="text-gray-600">Configure automated payment reminders</p>
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

        {/* Form */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          {/* Basic Info */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Policy Name *
                </label>
                <input
                  type="text"
                  value={policy.name || ''}
                  onChange={e => handleFieldChange('name', e.target.value)}
                  placeholder="e.g., Weekly Large Overdue Reminders"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={policy.description || ''}
                  onChange={e => handleFieldChange('description', e.target.value)}
                  placeholder="Optional description..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={policy.is_enabled || false}
                  onChange={e => handleFieldChange('is_enabled', e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                  Enabled
                </label>
              </div>
            </div>
          </section>

          <hr className="my-8" />

          {/* Trigger Configuration */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">When to Send Reminders</h2>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Balance Due (₦) *
                </label>
                <input
                  type="number"
                  value={
                    (policy.trigger_config as ReminderTriggerConfig)?.balance_due_threshold || 0
                  }
                  onChange={e => handleTriggerChange('balance_due_threshold', parseInt(e.target.value))}
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Reminders only sent if outstanding balance is at least this amount
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Days Overdue *
                </label>
                <input
                  type="number"
                  value={
                    (policy.trigger_config as ReminderTriggerConfig)?.days_overdue_threshold || 0
                  }
                  onChange={e => handleTriggerChange('days_overdue_threshold', parseInt(e.target.value))}
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Reminders only sent if payment is overdue by at least this many days
                </p>
              </div>
            </div>
          </section>

          <hr className="my-8" />

          {/* Recipient Configuration */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Who Receives Reminders</h2>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="recipient-type"
                    value="all_with_balance_due"
                    checked={
                      (policy.recipient_config as ReminderRecipientConfig)?.type ===
                      'all_with_balance_due'
                    }
                    onChange={e => handleRecipientChange('type', e.target.value)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Send to all contacts with outstanding balance
                  </span>
                </label>
              </div>
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="recipient-type"
                    value="specific_groups"
                    checked={
                      (policy.recipient_config as ReminderRecipientConfig)?.type ===
                      'specific_groups'
                    }
                    onChange={e => handleRecipientChange('type', e.target.value)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Send to specific groups only
                  </span>
                </label>
              </div>

              {(policy.recipient_config as ReminderRecipientConfig)?.type === 'specific_groups' && (
                <div className="ml-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-3">Select groups:</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {groups.length === 0 ? (
                      <p className="text-sm text-gray-500">No groups available</p>
                    ) : (
                      groups.map(group => (
                        <label key={group.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              (policy.recipient_config as ReminderRecipientConfig)?.group_ids?.includes(
                                group.id,
                              ) || false
                            }
                            onChange={() => toggleGroup(group.id)}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">{group.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <hr className="my-8" />

          {/* Cooldown & Frequency */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cooldown Period</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Days between reminders to same contact *
              </label>
              <input
                type="number"
                value={policy.cooldown_days || 7}
                onChange={e => handleFieldChange('cooldown_days', parseInt(e.target.value))}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-600 mt-1">
                Prevents sending multiple reminders to the same contact within this period
              </p>
            </div>
          </section>

          <hr className="my-8" />

          {/* Message Template */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Message Template</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message Template *
              </label>
              <textarea
                value={policy.message_template || ''}
                onChange={e => handleFieldChange('message_template', e.target.value)}
                placeholder="Dear {{contact_first_name}}, you have an outstanding balance of ₦{{balance_due}} that is {{days_overdue}} days overdue. Please pay immediately."
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
              <div className="mt-2 space-y-1">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Available Placeholders:
                </p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>
                    <code className="bg-gray-100 px-2 py-1 rounded">{'{{contact_first_name}}'}</code>{' '}
                    - Contact's first name
                  </li>
                  <li>
                    <code className="bg-gray-100 px-2 py-1 rounded">{'{{contact_full_name}}'}</code>{' '}
                    - Contact's full name
                  </li>
                  <li>
                    <code className="bg-gray-100 px-2 py-1 rounded">{'{{balance_due}}'}</code> -
                    Outstanding balance amount
                  </li>
                  <li>
                    <code className="bg-gray-100 px-2 py-1 rounded">{'{{days_overdue}}'}</code> -
                    Number of days overdue
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Message Preview */}
          {messagePreview && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Message Preview</h2>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{messagePreview}</p>
              </div>
            </section>
          )}

          <hr className="my-8" />

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Policy
                </>
              )}
            </button>
            <Link
              href="/dashboard/reminders"
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
