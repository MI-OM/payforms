// Organization Types
export interface Organization {
  id: string;
  name: string;
  email: string;
  paystack_public_key?: string;
  paystack_secret_key?: string;
  logo_url?: string;
  require_contact_login: boolean;
  created_at: Date;
}

// User Types (Admin/Staff)
export interface User {
  id: string;
  organization_id: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
  title?: string | null;
  designation?: string | null;
  created_at: Date;
}

// Contact Types
export interface Contact {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  phone?: string;
  external_id?: string;
  is_active: boolean;
  must_reset_password: boolean;
  created_at: Date;
}

// Group Types
export interface Group {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  note?: string | null;
  created_at: Date;
}

// Form Types
export interface Form {
  id: string;
  organization_id: string;
  title: string;
  category?: string;
  description?: string | null;
  note?: string | null;
  slug: string;
  payment_type: 'FIXED' | 'VARIABLE';
  amount?: number;
  allow_partial: boolean;
  is_active: boolean;
  created_at: Date;
}

// Form Field Types
export interface FormField {
  id: string;
  form_id: string;
  label: string;
  type: 'TEXT' | 'EMAIL' | 'SELECT' | 'NUMBER' | 'TEXTAREA';
  required: boolean;
  options?: string[];
  order_index: number;
  validation_rules?: Record<string, any>;
  created_at: Date;
}

// Submission Types
export interface Submission {
  id: string;
  form_id: string;
  organization_id: string;
  contact_id?: string;
  data: Record<string, any>;
  created_at: Date;
}

// Payment Types
export interface Payment {
  id: string;
  submission_id: string;
  organization_id: string;
  reference: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'FAILED';
  paid_at?: Date;
  created_at: Date;
}

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  user: User | Contact;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
