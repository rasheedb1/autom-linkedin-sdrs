import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  Cadence,
  CadenceInsert,
  CadenceUpdate,
  CadenceWithSteps,
  CadenceStep,
  CadenceStepInsert,
  CadenceStepUpdate,
  CadenceLead,
  ApiResponse,
} from '@/types';

export function useCadences() {
  const [cadences, setCadences] = useState<Cadence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCadences = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<ApiResponse<Cadence[]>>('/api/cadences');

      if (response.success && response.data) {
        setCadences(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch cadences');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch cadences';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const getCadence = useCallback(async (id: string): Promise<CadenceWithSteps | null> => {
    try {
      const response = await api.get<ApiResponse<CadenceWithSteps>>(`/api/cadences/${id}`);

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const createCadence = useCallback(async (data: CadenceInsert): Promise<Cadence | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<ApiResponse<Cadence>>('/api/cadences', data);

      if (response.success && response.data) {
        setCadences(prev => [response.data!, ...prev]);
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to create cadence');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create cadence';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCadence = useCallback(async (id: string, data: CadenceUpdate): Promise<Cadence | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.put<ApiResponse<Cadence>>(`/api/cadences/${id}`, data);

      if (response.success && response.data) {
        setCadences(prev => prev.map(c => c.id === id ? response.data! : c));
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to update cadence');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update cadence';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCadence = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.delete<ApiResponse<null>>(`/api/cadences/${id}`);

      if (response.success) {
        setCadences(prev => prev.filter(c => c.id !== id));
        return true;
      } else {
        throw new Error(response.error || 'Failed to delete cadence');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete cadence';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const activateCadence = useCallback(async (id: string): Promise<Cadence | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<ApiResponse<Cadence>>(`/api/cadences/${id}/activate`);

      if (response.success && response.data) {
        setCadences(prev => prev.map(c => c.id === id ? response.data! : c));
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to activate cadence');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to activate cadence';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const pauseCadence = useCallback(async (id: string): Promise<Cadence | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<ApiResponse<Cadence>>(`/api/cadences/${id}/pause`);

      if (response.success && response.data) {
        setCadences(prev => prev.map(c => c.id === id ? response.data! : c));
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to pause cadence');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pause cadence';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Step operations
  const getSteps = useCallback(async (cadenceId: string): Promise<CadenceStep[]> => {
    try {
      const response = await api.get<ApiResponse<CadenceStep[]>>(`/api/cadences/${cadenceId}/steps`);

      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  const createStep = useCallback(async (cadenceId: string, data: CadenceStepInsert): Promise<CadenceStep | null> => {
    try {
      const response = await api.post<ApiResponse<CadenceStep>>(`/api/cadences/${cadenceId}/steps`, data);

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const updateStep = useCallback(async (cadenceId: string, stepId: string, data: CadenceStepUpdate): Promise<CadenceStep | null> => {
    try {
      const response = await api.put<ApiResponse<CadenceStep>>(`/api/cadences/${cadenceId}/steps/${stepId}`, data);

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const deleteStep = useCallback(async (cadenceId: string, stepId: string): Promise<boolean> => {
    try {
      const response = await api.delete<ApiResponse<null>>(`/api/cadences/${cadenceId}/steps/${stepId}`);
      return response.success;
    } catch {
      return false;
    }
  }, []);

  const reorderSteps = useCallback(async (cadenceId: string, order: string[]): Promise<CadenceStep[]> => {
    try {
      const response = await api.post<ApiResponse<CadenceStep[]>>(`/api/cadences/${cadenceId}/steps/reorder`, { order });

      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  // Lead enrollment operations
  const getCadenceLeads = useCallback(async (cadenceId: string): Promise<CadenceLead[]> => {
    try {
      const response = await api.get<ApiResponse<CadenceLead[]>>(`/api/cadences/${cadenceId}/leads`);

      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  const enrollLeads = useCallback(async (cadenceId: string, leadIds: string[]): Promise<CadenceLead[]> => {
    try {
      const response = await api.post<ApiResponse<CadenceLead[]>>(`/api/cadences/${cadenceId}/leads`, { lead_ids: leadIds });

      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  const unenrollLead = useCallback(async (cadenceId: string, leadId: string): Promise<boolean> => {
    try {
      const response = await api.delete<ApiResponse<null>>(`/api/cadences/${cadenceId}/leads/${leadId}`);
      return response.success;
    } catch {
      return false;
    }
  }, []);

  const pauseLead = useCallback(async (cadenceId: string, cadenceLeadId: string): Promise<CadenceLead | null> => {
    try {
      const response = await api.post<ApiResponse<CadenceLead>>(`/api/cadences/${cadenceId}/leads/${cadenceLeadId}/pause`);

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const resumeLead = useCallback(async (cadenceId: string, cadenceLeadId: string): Promise<CadenceLead | null> => {
    try {
      const response = await api.post<ApiResponse<CadenceLead>>(`/api/cadences/${cadenceId}/leads/${cadenceLeadId}/resume`);

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  return {
    cadences,
    loading,
    error,
    fetchCadences,
    getCadence,
    createCadence,
    updateCadence,
    deleteCadence,
    activateCadence,
    pauseCadence,
    // Step operations
    getSteps,
    createStep,
    updateStep,
    deleteStep,
    reorderSteps,
    // Lead enrollment operations
    getCadenceLeads,
    enrollLeads,
    unenrollLead,
    pauseLead,
    resumeLead,
  };
}
