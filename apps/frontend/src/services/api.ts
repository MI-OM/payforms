import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface AdminLoginResponse {
  access_token?: string;
  refresh_token?: string;
  user?: any;
  requires_two_factor?: boolean;
  challenge_token?: string;
  challenge_expires_in?: string;
}

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for auth
    this.client.interceptors.request.use(config => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest?._retry && !this.isAuthRefreshRequest(originalRequest?.url)) {
          originalRequest._retry = true;

          const refreshedToken = await this.refreshSession();
          if (refreshedToken) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
            return this.client(originalRequest);
          }
        }

        if (error.response?.status === 401) {
          this.clearAuthToken();
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      },
    );
  }

  setAuthToken(token: string) {
    this.token = token;
    this.client.defaults.headers.Authorization = `Bearer ${token}`;
  }

  clearAuthToken() {
    this.token = null;
    delete this.client.defaults.headers.Authorization;
  }

  // Auth endpoints
  async register(
    organizationName: string,
    email: string,
    password: string,
    title?: string,
    designation?: string,
  ) {
    const response = await this.client.post('/auth/register', {
      organization_name: organizationName,
      email,
      title,
      designation,
      password,
    });
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data as AdminLoginResponse;
  }

  async verifyTwoFactorLogin(challengeToken: string, code?: string, recoveryCode?: string) {
    const response = await this.client.post('/auth/2fa/verify-login', {
      challenge_token: challengeToken,
      code,
      recovery_code: recoveryCode,
    });
    return response.data as AdminLoginResponse;
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } finally {
      this.clearAuthToken();
    }
  }

  async requestPasswordReset(email: string) {
    const response = await this.client.post('/auth/password-reset/request', { email });
    return response.data;
  }

  async confirmPasswordReset(token: string, password: string) {
    const response = await this.client.post('/auth/password-reset/confirm', {
      token,
      password,
    });
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Organization endpoints
  async getOrganization() {
    const response = await this.client.get('/organization');
    return response.data;
  }

  async updateOrganization(data: any) {
    const response = await this.client.patch('/organization', data);
    return response.data;
  }

  async getOrganizationSettings() {
    const response = await this.client.get('/organization/settings');
    return response.data;
  }

  async verifyOrganizationEmail(token: string) {
    const response = await this.client.post('/auth/organization-email/verify', { token });
    return response.data;
  }

  async requestOrganizationEmailVerification() {
    const response = await this.client.post('/auth/organization-email/request-verification');
    return response.data;
  }

  async getOrganizationEmailVerificationStatus() {
    const response = await this.client.get('/auth/organization-email/status');
    return response.data;
  }

  async updatePaystackKeys(publicKey: string, secretKey: string) {
    const response = await this.client.patch('/organization/keys', {
      paystack_public_key: publicKey,
      paystack_secret_key: secretKey,
    });
    return response.data;
  }

  // Contact endpoints
  async createContact(name: string, email: string, phone?: string, externalId?: string) {
    const response = await this.client.post('/contacts', {
      name,
      email,
      phone,
      external_id: externalId,
    });
    return response.data;
  }

  async listContacts(page: number = 1, limit: number = 20) {
    const response = await this.client.get('/contacts', { params: { page, limit } });
    return response.data;
  }

  async getContact(id: string) {
    const response = await this.client.get(`/contacts/${id}`);
    return response.data;
  }

  async updateContact(id: string, data: any) {
    const response = await this.client.patch(`/contacts/${id}`, data);
    return response.data;
  }

  async deleteContact(id: string) {
    const response = await this.client.delete(`/contacts/${id}`);
    return response.data;
  }

  async bulkImportContacts(contacts: Array<any>) {
    const response = await this.client.post('/contacts/import', { contacts });
    return response.data;
  }

  // Group endpoints
  async createGroup(name: string, description?: string, note?: string) {
    const response = await this.client.post('/groups', { name, description, note });
    return response.data;
  }

  async listGroups(page: number = 1, limit: number = 20) {
    const response = await this.client.get('/groups', { params: { page, limit } });
    return response.data;
  }

  async getGroup(id: string) {
    const response = await this.client.get(`/groups/${id}`);
    return response.data;
  }

  async updateGroup(id: string, data: any) {
    const response = await this.client.patch(`/groups/${id}`, data);
    return response.data;
  }

  async deleteGroup(id: string) {
    const response = await this.client.delete(`/groups/${id}`);
    return response.data;
  }

  async addContactsToGroup(groupId: string, contactIds: string[]) {
    const response = await this.client.post(`/groups/${groupId}/contacts`, {
      contact_ids: contactIds,
    });
    return response.data;
  }

  async getGroupContacts(groupId: string, page: number = 1, limit: number = 20) {
    const response = await this.client.get(`/groups/${groupId}/contacts`, {
      params: { page, limit },
    });
    return response.data;
  }

  private async refreshSession() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.client
      .post('/auth/refresh', {})
      .then(response => {
        const accessToken = response.data?.access_token ?? null;
        if (accessToken) {
          this.setAuthToken(accessToken);
        }
        return accessToken;
      })
      .catch(() => {
        this.clearAuthToken();
        return null;
      })
      .finally(() => {
        this.isRefreshing = false;
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  private isAuthRefreshRequest(url?: string) {
    return typeof url === 'string' && url.includes('/auth/refresh');
  }
}

export const apiClient = new ApiClient();
