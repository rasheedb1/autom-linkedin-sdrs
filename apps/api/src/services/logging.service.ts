import { SupabaseClient } from '@supabase/supabase-js';
import type { MessageChannel } from '../types/api.js';

export type LogAction =
  | 'send_message'
  | 'send_all'
  | 'like_last_post'
  | 'balance'
  | 'connect_linkedin';

export type LogStatus = 'success' | 'error';

export interface LogEntry {
  userId: string;
  action: LogAction;
  leadId?: string;
  status: LogStatus;
  channel?: MessageChannel;
  requestId?: string;
  errorCode?: string;
  raw?: Record<string, unknown>;
}

/**
 * Logging Service
 *
 * Records all execution logs to the database for tracking and analytics.
 */
export class LoggingService {
  constructor(private supabaseAdmin: SupabaseClient) {}

  /**
   * Log an action execution
   */
  async log(entry: LogEntry): Promise<void> {
    const { error } = await this.supabaseAdmin
      .from('execution_logs')
      .insert({
        user_id: entry.userId,
        action: entry.action,
        lead_id: entry.leadId,
        status: entry.status,
        channel: entry.channel,
        request_id: entry.requestId,
        error_code: entry.errorCode,
        raw: entry.raw,
      });

    if (error) {
      console.error('Failed to log execution:', error);
      // Don't throw - logging should not break the main flow
    }
  }

  /**
   * Log a successful message send
   */
  async logMessageSent(
    userId: string,
    leadId: string,
    channel: MessageChannel,
    requestId?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'send_message',
      leadId,
      status: 'success',
      channel,
      requestId,
    });
  }

  /**
   * Log a failed message send
   */
  async logMessageFailed(
    userId: string,
    leadId: string,
    errorCode: string,
    channel?: MessageChannel,
    requestId?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'send_message',
      leadId,
      status: 'error',
      channel,
      errorCode,
      requestId,
    });
  }

  /**
   * Log bulk send operation
   */
  async logBulkSend(
    userId: string,
    summary: {
      total: number;
      sent: number;
      failed: number;
      linkedinMessageSent: number;
      salesnavInmailSent: number;
    }
  ): Promise<void> {
    await this.log({
      userId,
      action: 'send_all',
      status: summary.failed === 0 ? 'success' : 'error',
      raw: summary,
    });
  }

  /**
   * Log like post action
   */
  async logLikePost(
    userId: string,
    leadId: string,
    success: boolean,
    errorCode?: string,
    requestId?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'like_last_post',
      leadId,
      status: success ? 'success' : 'error',
      errorCode,
      requestId,
    });
  }

  /**
   * Log balance check
   */
  async logBalanceCheck(
    userId: string,
    success: boolean,
    credits?: number,
    errorCode?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'balance',
      status: success ? 'success' : 'error',
      errorCode,
      raw: credits !== undefined ? { credits } : undefined,
    });
  }

  /**
   * Log LinkedIn connection
   */
  async logLinkedInConnect(
    userId: string,
    success: boolean,
    errorCode?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'connect_linkedin',
      status: success ? 'success' : 'error',
      errorCode,
    });
  }

  /**
   * Get execution logs for a user
   */
  async getUserLogs(
    userId: string,
    options?: {
      action?: LogAction;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ logs: Array<Record<string, unknown>>; count: number }> {
    let query = this.supabaseAdmin
      .from('execution_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.action) {
      query = query.eq('action', options.action);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to get logs:', error);
      return { logs: [], count: 0 };
    }

    return { logs: data || [], count: count || 0 };
  }
}
