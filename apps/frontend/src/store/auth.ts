import { create } from 'zustand';
import { apiClient } from '../services/api';

interface User {
  id: string;
  email: string;
  organization_id: string;
  role: string;
  title?: string | null;
  designation?: string | null;
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  register: (orgName: string, email: string, password: string, title?: string, designation?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  register: async (orgName: string, email: string, password: string, title?: string, designation?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.register(orgName, email, password, title, designation);
      apiClient.setAuthToken(response.access_token);
      set({ user: response.user, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Registration failed',
        isLoading: false,
      });
      throw error;
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.login(email, password);
      apiClient.setAuthToken(response.access_token);
      set({ user: response.user, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Login failed',
        isLoading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    await apiClient.logout();
    set({ user: null });
  },

  fetchCurrentUser: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.getMe();
      set({ user: response, isLoading: false });
    } catch (error) {
      set({ isLoading: false, user: null });
    }
  },
}));
