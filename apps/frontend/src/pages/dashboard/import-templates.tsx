import { useCallback, useEffect, useState } from 'react';
import {
  importTemplateService,
  STANDARD_CONTACT_FIELDS,
  CUSTOM_FIELD_TYPES,
  type CustomFieldDefinition,
  type FieldConfig,
  type ImportTemplate,
} from '@/services/importTemplateService';
import { AlertCircle, Plus, Trash2, Settings2, Star } from 'lucide-react';

type FieldsConfig = Record<string, FieldConfig>;

function buildInitialFieldsConfig(): FieldsConfig {
  const config: FieldsConfig = {};
  for (const [name, meta] of Object.entries(STANDARD_CONTACT_FIELDS)) {
    config[name] = {
      visible: true,
      required: meta.defaultRequired,
      label: meta.label,
    };
  }
  return config;
}

export default function ImportTemplatesPage() {
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [fieldsConfig, setFieldsConfig] = useState<FieldsConfig>(buildInitialFieldsConfig());
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await importTemplateService.listTemplates();
      setTemplates(data || []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load import templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setIsDefault(false);
    setFieldsConfig(buildInitialFieldsConfig());
    setCustomFields([]);
  };

  const startEdit = (template: ImportTemplate) => {
    setEditingId(template.id);
    setName(template.name);
    setDescription(template.description || '');
    setIsDefault(template.is_default);
    setFieldsConfig({ ...buildInitialFieldsConfig(), ...template.fields_config });
    setCustomFields(template.custom_fields || []);
    setError(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        fields_config: fieldsConfig,
        custom_fields: customFields,
        is_default: isDefault,
      };

      if (editingId) {
        await importTemplateService.updateTemplate(editingId, payload);
        setNotice('Template updated.');
      } else {
        await importTemplateService.createTemplate(payload);
        setNotice('Template created.');
      }

      resetForm();
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      await importTemplateService.deleteTemplate(templateId);
      setTemplates((current) => current.filter((t) => t.id !== templateId));
      setDeleteConfirm(null);
      setNotice('Template deleted.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete template');
    }
  };

  const toggleField = (fieldName: string, key: 'visible' | 'required') => {
    setFieldsConfig((current) => ({
      ...current,
      [fieldName]: {
        ...current[fieldName],
        [key]: !current[fieldName]?.[key],
      },
    }));
  };

  const updateFieldLabel = (fieldName: string, label: string) => {
    setFieldsConfig((current) => ({
      ...current,
      [fieldName]: {
        visible: current[fieldName]?.visible ?? true,
        required: current[fieldName]?.required ?? false,
        label,
      },
    }));
  };

  const addCustomField = () => {
    setCustomFields((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: `custom_field_${current.length + 1}`,
        label: `Custom Field ${current.length + 1}`,
        type: 'text',
        required: false,
      },
    ]);
  };

  const updateCustomField = (index: number, patch: Partial<CustomFieldDefinition>) => {
    setCustomFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    );
  };

  const removeCustomField = (index: number) => {
    setCustomFields((current) => current.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Import Templates</h1>
            <p className="mt-2 text-gray-600">
              Define which fields an import expects, and which of them are required.
            </p>
          </div>
          {editingId && (
            <button
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          )}
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

        {/* Editor */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit template' : 'New template'}
          </h2>

          <div className="grid gap-4 md:grid-cols-2 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Student intake 2026"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this template for?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700 mb-6">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Use as the default template for new imports
          </label>

          {/* Standard fields */}
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
            Standard fields
          </h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                    Field
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase w-48">
                    Label
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase w-24">
                    Visible
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase w-24">
                    Required
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(fieldsConfig).map(([fieldName, config]) => (
                  <tr key={fieldName}>
                    <td className="px-4 py-2 text-sm text-gray-900">{fieldName}</td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={config.label}
                        onChange={(e) => updateFieldLabel(fieldName, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={config.visible}
                        onChange={() => toggleField(fieldName, 'visible')}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={config.required}
                        onChange={() => toggleField(fieldName, 'required')}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Custom fields */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Custom fields
            </h3>
            <button
              onClick={addCustomField}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add field
            </button>
          </div>

          {customFields.length === 0 ? (
            <p className="text-sm text-gray-500 mb-6">
              No custom fields. Custom fields let you capture data the contact record does
              not have a column for.
            </p>
          ) : (
            <div className="space-y-3 mb-6">
              {customFields.map((field, index) => (
                <div
                  key={field.id}
                  className="border border-gray-200 rounded-lg p-4 grid gap-3 md:grid-cols-5"
                >
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateCustomField(index, { label: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select
                      value={field.type}
                      onChange={(e) =>
                        updateCustomField(index, {
                          type: e.target.value as CustomFieldDefinition['type'],
                        })
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {CUSTOM_FIELD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateCustomField(index, { required: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Required
                    </label>
                  </div>
                  <div className="flex items-end justify-end">
                    <button
                      onClick={() => removeCustomField(index)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Remove field"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create template'}
          </button>
        </div>

        {/* Template list */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">Your templates</h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-600">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
            <Settings2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates yet</h3>
            <p className="text-gray-600">
              Create a template above to control what an import expects.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-lg shadow border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                      {template.is_default && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <Star className="h-3 w-3" />
                          Default
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-600">{template.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {Object.values(template.fields_config || {}).filter((f) => f.required).length}{' '}
                      required field(s)
                      {(template.custom_fields || []).length > 0 &&
                        ` • ${template.custom_fields.length} custom field(s)`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(template)}
                      className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(template.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {deleteConfirm === template.id && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
                    <p className="text-sm text-red-800">
                      Delete &quot;{template.name}&quot;? This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
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
      </div>
    </div>
  );
}
