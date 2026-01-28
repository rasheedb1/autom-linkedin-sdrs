import { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityLog } from '../types/database.js';

export interface ActivityFilters {
  cadenceId?: string;
  leadId?: string;
  action?: string;
  status?: 'ok' | 'failed';
  from?: string; // ISO date
  to?: string; // ISO date
  limit?: number;
  offset?: number;
}

export interface ActivityStats {
  total_actions: number;
  successful: number;
  failed: number;
  by_action: Record<string, number>;
  by_day: Array<{ date: string; count: number }>;
}

/**
 * Activity Service
 *
 * Handles activity logging and retrieval
 */
export class ActivityService {
  constructor(private supabaseAdmin: SupabaseClient) {}

  /**
   * Get activity logs with filters
   */
  async getActivityLog(
    ownerId: string,
    filters: ActivityFilters = {}
  ): Promise<{ logs: ActivityLog[]; total: number }> {
    let query = this.supabaseAdmin
      .from('activity_log')
      .select('*', { count: 'exact' })
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (filters.cadenceId) {
      query = query.eq('cadence_id', filters.cadenceId);
    }

    if (filters.leadId) {
      query = query.eq('lead_id', filters.leadId);
    }

    if (filters.action) {
      query = query.ilike('action', `%${filters.action}%`);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.from) {
      query = query.gte('created_at', filters.from);
    }

    if (filters.to) {
      query = query.lte('created_at', filters.to);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch activity log: ${error.message}`);
    }

    return {
      logs: data || [],
      total: count || 0,
    };
  }

  /**
   * Get activity stats for a time period
   */
  async getActivityStats(
    ownerId: string,
    options: { days?: number; cadenceId?: string } = {}
  ): Promise<ActivityStats> {
    const { days = 7, cadenceId } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = this.supabaseAdmin
      .from('activity_log')
      .select('*')
      .eq('owner_id', ownerId)
      .gte('created_at', startDate.toISOString());

    if (cadenceId) {
      query = query.eq('cadence_id', cadenceId);
    }

    const { data: logs } = await query;

    if (!logs || logs.length === 0) {
      return {
        total_actions: 0,
        successful: 0,
        failed: 0,
        by_action: {},
        by_day: [],
      };
    }

    // Aggregate stats
    const successful = logs.filter(l => l.status === 'ok').length;
    const failed = logs.filter(l => l.status === 'failed').length;

    // Group by action
    const byAction: Record<string, number> = {};
    for (const log of logs) {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
    }

    // Group by day
    const byDayMap: Record<string, number> = {};
    for (const log of logs) {
      const date = log.created_at.split('T')[0];
      byDayMap[date] = (byDayMap[date] || 0) + 1;
    }

    const byDay = Object.entries(byDayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      total_actions: logs.length,
      successful,
      failed,
      by_action: byAction,
      by_day: byDay,
    };
  }

  /**
   * Get recent activity for dashboard
   */
  async getRecentActivity(
    ownerId: string,
    limit = 10
  ): Promise<Array<ActivityLog & { lead_name?: string; cadence_name?: string }>> {
    const { data: logs } = await this.supabaseAdmin
      .from('activity_log')
      .select(`
        *,
        lead:leads(first_name, last_name),
        cadence:cadences(name)
      `)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!logs) return [];

    return logs.map(log => ({
      ...log,
      lead_name: log.lead
        ? `${log.lead.first_name || ''} ${log.lead.last_name || ''}`.trim() || undefined
        : undefined,
      cadence_name: log.cadence?.name,
    }));
  }

  /**
   * Log a custom activity
   */
  async logActivity(
    ownerId: string,
    params: {
      cadenceId?: string;
      stepId?: string;
      leadId?: string;
      action: string;
      status: 'ok' | 'failed';
      details?: Record<string, unknown>;
    }
  ): Promise<ActivityLog> {
    const { data, error } = await this.supabaseAdmin
      .from('activity_log')
      .insert({
        owner_id: ownerId,
        cadence_id: params.cadenceId,
        cadence_step_id: params.stepId,
        lead_id: params.leadId,
        action: params.action,
        status: params.status,
        details: params.details,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to log activity: ${error.message}`);
    }

    return data;
  }
}
