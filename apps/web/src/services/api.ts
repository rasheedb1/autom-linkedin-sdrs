import { supabase } from '@/lib/supabase';

// When deploying to Vercel, frontend and API are on the same domain
// Default to empty string (relative URLs) for same-origin deployment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

class ApiService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession();

    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  }

  private buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
    // Handle both absolute URLs (external API) and relative URLs (same domain)
    const baseUrl = API_BASE_URL || window.location.origin;
    const url = new URL(`${baseUrl}${path}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    // Return relative path for same-origin requests
    if (!API_BASE_URL) {
      return `${url.pathname}${url.search}`;
    }

    return url.toString();
  }

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const headers = await this.getAuthHeaders();

    const response = await fetch(this.buildUrl(path, params), {
      method: 'GET',
      headers,
      ...fetchOptions,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
  }

  async post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const headers = await this.getAuthHeaders();

    const response = await fetch(this.buildUrl(path, params), {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...fetchOptions,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
  }

  async put<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const headers = await this.getAuthHeaders();

    const response = await fetch(this.buildUrl(path, params), {
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...fetchOptions,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
  }

  async delete<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const headers = await this.getAuthHeaders();

    const response = await fetch(this.buildUrl(path, params), {
      method: 'DELETE',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...fetchOptions,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
  }
}

export const api = new ApiService();
