import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { Lead, LeadInsert, LeadUpdate, ApiResponse, PaginatedResponse } from '@/types';

interface UseLeadsOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

export function useLeads(options: UseLeadsOptions = {}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async (fetchOptions?: UseLeadsOptions) => {
    setLoading(true);
    setError(null);

    try {
      const params = { ...options, ...fetchOptions };
      const response = await api.get<PaginatedResponse<Lead>>('/api/leads', { params });

      if (response.success && response.data) {
        setLeads(response.data);
        setTotal(response.total || 0);
      } else {
        throw new Error(response.error || 'Failed to fetch leads');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch leads';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [options]);

  const getLead = useCallback(async (id: string): Promise<Lead | null> => {
    try {
      const response = await api.get<ApiResponse<Lead>>(`/api/leads/${id}`);

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const createLead = useCallback(async (data: LeadInsert): Promise<Lead | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<ApiResponse<Lead>>('/api/leads', data);

      if (response.success && response.data) {
        setLeads(prev => [response.data!, ...prev]);
        setTotal(prev => prev + 1);
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to create lead');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create lead';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const importLeads = useCallback(async (leadsData: LeadInsert[]): Promise<Lead[] | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<ApiResponse<Lead[]>>('/api/leads/import', { leads: leadsData });

      if (response.success && response.data) {
        setLeads(prev => [...response.data!, ...prev]);
        setTotal(prev => prev + response.data!.length);
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to import leads');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import leads';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateLead = useCallback(async (id: string, data: LeadUpdate): Promise<Lead | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.put<ApiResponse<Lead>>(`/api/leads/${id}`, data);

      if (response.success && response.data) {
        setLeads(prev => prev.map(lead => lead.id === id ? response.data! : lead));
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to update lead');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update lead';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteLead = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.delete<ApiResponse<null>>(`/api/leads/${id}`);

      if (response.success) {
        setLeads(prev => prev.filter(lead => lead.id !== id));
        setTotal(prev => prev - 1);
        return true;
      } else {
        throw new Error(response.error || 'Failed to delete lead');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete lead';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteLeads = useCallback(async (ids: string[]): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.delete<ApiResponse<null>>('/api/leads', { ids });

      if (response.success) {
        setLeads(prev => prev.filter(lead => !ids.includes(lead.id)));
        setTotal(prev => prev - ids.length);
        return true;
      } else {
        throw new Error(response.error || 'Failed to delete leads');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete leads';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    leads,
    total,
    loading,
    error,
    fetchLeads,
    getLead,
    createLead,
    importLeads,
    updateLead,
    deleteLead,
    deleteLeads,
  };
}
