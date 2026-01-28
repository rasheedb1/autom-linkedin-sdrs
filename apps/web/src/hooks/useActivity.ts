import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { ApiResponse, ActivityLog } from '@/types';

interface ActivityFilters {
  cadence_id?: string;
  lead_id?: string;
  action?: string;
  status?: 'ok' | 'failed';
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

interface ActivityStats {
  total_actions: number;
  successful: number;
  failed: number;
  by_action: Record<string, number>;
  by_day: Array<{ date: string; count: number }>;
}

interface RecentActivity extends ActivityLog {
  lead_name?: string;
  cadence_name?: string;
}

export function useActivity() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch activity log with filters
   */
  const fetchActivity = useCallback(async (filters: ActivityFilters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string | number | undefined> = {};
      if (filters.cadence_id) params.cadence_id = filters.cadence_id;
      if (filters.lead_id) params.lead_id = filters.lead_id;
      if (filters.action) params.action = filters.action;
      if (filters.status) params.status = filters.status;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.limit) params.limit = filters.limit;
      if (filters.offset) params.offset = filters.offset;

      const response = await api.get<ApiResponse<ActivityLog[]> & { total: number }>('/api/activity', { params });

      if (response.success && response.data) {
        setActivities(response.data);
        setTotal(response.total || 0);
      } else {
        throw new Error(response.error || 'Failed to fetch activity');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch activity';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get recent activity for dashboard
   */
  const getRecentActivity = useCallback(async (limit = 10): Promise<RecentActivity[]> => {
    try {
      const response = await api.get<ApiResponse<RecentActivity[]>>('/api/activity/recent', {
        params: { limit },
      });

      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  /**
   * Get activity stats
   */
  const getActivityStats = useCallback(async (
    days = 7,
    cadenceId?: string
  ): Promise<ActivityStats | null> => {
    try {
      const params: Record<string, string | number | undefined> = { days };
      if (cadenceId) params.cadence_id = cadenceId;

      const response = await api.get<ApiResponse<ActivityStats>>('/api/activity/stats', { params });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  return {
    activities,
    total,
    loading,
    error,
    fetchActivity,
    getRecentActivity,
    getActivityStats,
  };
}
