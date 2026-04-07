import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { getCallbackUrl } from '../../../utils/config';

interface FormField {
  id: string;
  label: string;
  type: 'TEXT' | 'EMAIL' | 'SELECT' | 'NUMBER' | 'TEXTAREA';
  required: boolean;
  options?: string[];
}

interface FormData {
  id: string;
  title: string;
  category: string;
  slug: string;
  payment_type: 'FIXED' | 'VARIABLE';
  amount: number;
  allow_partial: boolean;
  fields: FormField[];
}

interface SubmissionData {
  [key: string]: any;
  contact_email?: string;
  contact_name?: string;
}

export default function PublicForm() {
  const router = useRouter();
  const { slug } = router.query;
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<SubmissionData>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (slug) {
      fetchForm();
    }
  }, [slug]);

  const fetchForm = async () => {
    try {
      const response = await axios.get(`/api/public/forms/${slug}`);
      setForm(response.data);
    } catch (error) {
      console.error('Failed to fetch form:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (fieldLabel: string, value: any) => {
    setData(prev => ({ ...prev, [fieldLabel]: value }));
    if (errors[fieldLabel]) {
      setErrors(prev => ({ ...prev, [fieldLabel]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    form?.fields.forEach(field => {
      const value = data[field.label];
      if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        newErrors[field.label] = 'This field is required';
      }

      if (value && field.type === 'EMAIL') {
        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[field.label] = 'Please enter a valid email address';
        }
      }

      if (value && field.type === 'NUMBER') {
        const num = Number(value);
        if (isNaN(num)) {
          newErrors[field.label] = 'Please enter a valid number';
        }
      }

      if (value && field.type === 'SELECT' && field.options && !field.options.includes(value)) {
        newErrors[field.label] = 'Please select a valid option';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      // Include callback_url so Paystack returns to the frontend callback page
      // Use environment-configured URL instead of window.location.origin to support Vercel deployments
      const callbackUrl = getCallbackUrl('/paystack/callback');
      const response = await axios.post(`/api/public/forms/${slug}/submit?callback_url=${encodeURIComponent(callbackUrl)}`, {
        data,
        contact_email: data.contact_email,
        contact_name: data.contact_name,
      });

      const { authorization, submission } = response.data;

      // Check if payment is required
      if (authorization?.authorization_url) {
        // Redirect to Paystack for payment
        window.location.href = authorization.authorization_url;
      } else {
        // Free form - redirect to success page directly
        router.push('/payment/success');
      }
    } catch (error: any) {
      console.error('Submission failed:', error);
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Form Not Found</h1>
          <p className="text-gray-600">The form you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
          {form.category && (
            <p className="text-sm text-gray-600 mt-1">{form.category}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {form.fields.map(field => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </label>

              {field.type === 'TEXTAREA' ? (
                <textarea
                  value={data[field.label] || ''}
                  onChange={(e) => handleInputChange(field.label, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              ) : field.type === 'SELECT' ? (
                <select
                  value={data[field.label] || ''}
                  onChange={(e) => handleInputChange(field.label, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select an option</option>
                  {field.options?.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'EMAIL' ? 'email' : field.type === 'NUMBER' ? 'number' : 'text'}
                  value={data[field.label] || ''}
                  onChange={(e) => handleInputChange(field.label, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {errors[field.label] && (
                <p className="mt-1 text-sm text-red-600">{errors[field.label]}</p>
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit & Pay'}
          </button>
        </form>
      </div>
    </div>
  );
}
