import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { ApiResponse } from '@/types';

interface ExecuteStepResult {
  step_instance_id?: string;
  channel?: string;
  request_id?: string;
}

interface BatchExecuteResult {
  total: number;
  executed: number;
  failed: number;
  skipped: number;
  results: Array<{
    cadenceLeadId: string;
    leadId: string;
    stepId: string;
    result: {
      success: boolean;
      error?: string;
      errorCode?: string;
    };
  }>;
}

interface WeeklyStats {
  linkedin_sent: number;
  sales_navigator_sent: number;
  week_start: string;
}

interface PendingLead {
  id: string;
  cadence_id: string;
  lead_id: string;
  status: string;
  lead: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    linkedin_url: string | null;
    company: string | null;
  };
  next_step: {
    id: string;
    step_type: string;
    step_label: string | null;
    day_offset: number;
  } | null;
}

export function useExecution() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Execute a specific step for a lead
   */
  const executeStep = useCallback(async (
    cadenceLeadId: string,
    stepId: string
  ): Promise<ExecuteStepResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<ApiResponse<ExecuteStepResult>>('/api/execution/send', {
        cadence_lead_id: cadenceLeadId,
        step_id: stepId,
      });

      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Execution failed');
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Execute the next pending step for a lead
   */
  const executeNextStep = useCallback(async (
    cadenceLeadId: string
  ): Promise<ExecuteStepResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<ApiResponse<ExecuteStepResult>>('/api/execution/send-next', {
        cadence_lead_id: cadenceLeadId,
      });

      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Execution failed');
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Execute batch for a cadence
   */
  const executeBatch = useCallback(async (
    cadenceId: string,
    limit?: number
  ): Promise<BatchExecuteResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<ApiResponse<BatchExecuteResult>>('/api/execution/send-all', {
        cadence_id: cadenceId,
        limit,
      });

      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Batch execution failed');
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Batch execution failed';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get pending leads for a cadence
   */
  const getPendingLeads = useCallback(async (
    cadenceId: string
  ): Promise<PendingLead[]> => {
    try {
      const response = await api.get<ApiResponse<PendingLead[]>>(`/api/execution/pending/${cadenceId}`);

      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  /**
   * Get weekly stats
   */
  const getWeeklyStats = useCallback(async (): Promise<WeeklyStats | null> => {
    try {
      const response = await api.get<ApiResponse<WeeklyStats>>('/api/execution/stats/weekly');

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  return {
    loading,
    error,
    executeStep,
    executeNextStep,
    executeBatch,
    getPendingLeads,
    getWeeklyStats,
  };
}
