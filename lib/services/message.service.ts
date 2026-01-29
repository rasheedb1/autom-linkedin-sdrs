import { getSupabaseAdmin } from '../db/supabase';
import { unipileService, UnipileError } from './unipile.service';
import { parseLinkedInIdentifier } from '../helpers/linkedin';
import { renderTemplate, LeadTemplateData } from '../helpers/template';
import type { MessageChannel, SendAllResult } from '../types/api';
import { UnipileErrorCode } from '../types/unipile';

export interface SendMessageParams {
  userId: string;
  leadId: string;
  linkedinUrl: string;
  messageBody: string;
  leadData?: LeadTemplateData;
}

export interface SendMessageResult {
  success: boolean;
  channel?: MessageChannel;
  requestId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Message Service
 *
 * Handles sending LinkedIn messages with automatic fallback to InMail
 * when regular messaging fails.
 */
export class MessageService {
  private get supabase() {
    return getSupabaseAdmin();
  }

  /**
   * Get the user's connected Unipile account ID
   */
  async getUnipileAccountId(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('unipile_accounts')
      .select('unipile_account_id')
      .eq('user_id', userId)
      .eq('provider', 'LINKEDIN')
      .eq('status', 'connected')
      .single();

    if (error || !data) {
      return null;
    }

    return data.unipile_account_id;
  }

  /**
   * Resolve LinkedIn handle to provider_internal_id
   */
  async resolveRecipientId(
    handle: string,
    accountId: string
  ): Promise<{ recipientId: string; requestId?: string } | null> {
    try {
      const { user, requestId } = await unipileService.getUserByHandle(handle, accountId);
      return { recipientId: user.provider_id, requestId };
    } catch (error) {
      if (error instanceof UnipileError && error.code === UnipileErrorCode.USER_NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Send a message with automatic fallback to InMail
   *
   * Flow:
   * 1. Try regular LinkedIn message
   * 2. If fails due to "not connected", fallback to InMail
   */
  async sendMessageWithFallback(params: SendMessageParams): Promise<SendMessageResult> {
    const { userId, linkedinUrl, messageBody, leadData } = params;

    // Get user's Unipile account
    const accountId = await this.getUnipileAccountId(userId);
    if (!accountId) {
      return {
        success: false,
        error: 'No connected LinkedIn account found',
        errorCode: 'NO_ACCOUNT',
      };
    }

    // Parse LinkedIn handle from URL
    const handle = parseLinkedInIdentifier(linkedinUrl);
    if (!handle) {
      return {
        success: false,
        error: 'Invalid LinkedIn URL',
        errorCode: 'INVALID_URL',
      };
    }

    // Resolve recipient ID
    const resolved = await this.resolveRecipientId(handle, accountId);
    if (!resolved) {
      return {
        success: false,
        error: 'Could not find LinkedIn user',
        errorCode: 'USER_NOT_FOUND',
      };
    }

    const { recipientId } = resolved;

    // Render template if lead data provided
    const renderedMessage = leadData
      ? renderTemplate(messageBody, { ...leadData, linkedin_url: linkedinUrl })
      : messageBody;

    // Step 1: Try regular LinkedIn message
    try {
      const result = await unipileService.sendMessage({
        accountId,
        recipientId,
        text: renderedMessage,
        inmail: false,
      });

      return {
        success: true,
        channel: 'linkedin_message',
        requestId: result.requestId,
      };
    } catch (error) {
      // Check if we should fallback to InMail
      if (!this.shouldFallbackToInMail(error)) {
        // Re-throw non-recoverable errors
        if (error instanceof UnipileError) {
          return {
            success: false,
            error: error.message,
            errorCode: error.code,
            requestId: error.requestId,
          };
        }
        throw error;
      }

      // Log that we're attempting fallback
      console.log(`Falling back to InMail for ${handle}`);
    }

    // Step 2: Fallback to InMail
    try {
      const result = await unipileService.sendMessage({
        accountId,
        recipientId,
        text: renderedMessage,
        inmail: true,
      });

      return {
        success: true,
        channel: 'salesnav_inmail',
        requestId: result.requestId,
      };
    } catch (error) {
      if (error instanceof UnipileError) {
        return {
          success: false,
          channel: 'salesnav_inmail',
          error: error.message,
          errorCode: error.code,
          requestId: error.requestId,
        };
      }
      throw error;
    }
  }

  /**
   * Determine if we should fallback to InMail based on error
   */
  private shouldFallbackToInMail(error: unknown): boolean {
    if (!(error instanceof UnipileError)) {
      return false;
    }

    // Error codes that indicate InMail is needed
    if (error.code === UnipileErrorCode.MESSAGING_NOT_ALLOWED) {
      return true;
    }

    // Check error message for fallback indicators
    const fallbackIndicators = [
      'not connected',
      'cannot message',
      'connection required',
      'not a connection',
      'must be connected',
      'invitation required',
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return fallbackIndicators.some(indicator => errorMessage.includes(indicator));
  }

  /**
   * Send messages to multiple leads (bulk operation)
   *
   * @param userId User ID
   * @param leads Array of leads with their data
   * @param messageTemplate Template with placeholders
   * @param concurrency Max concurrent operations (default: 3)
   */
  async sendAll(
    userId: string,
    leads: Array<{
      lead_id: string;
      linkedin_url: string;
      first_name?: string;
      last_name?: string;
      company?: string;
    }>,
    messageTemplate: string,
    concurrency = 3
  ): Promise<{
    total: number;
    sent: number;
    failed: number;
    linkedinMessageSent: number;
    salesnavInmailSent: number;
    results: SendAllResult[];
  }> {
    const results: SendAllResult[] = [];
    let linkedinMessageSent = 0;
    let salesnavInmailSent = 0;

    // Process in batches for rate limiting
    for (let i = 0; i < leads.length; i += concurrency) {
      const batch = leads.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(async (lead) => {
          const result = await this.sendMessageWithFallback({
            userId,
            leadId: lead.lead_id,
            linkedinUrl: lead.linkedin_url,
            messageBody: messageTemplate,
            leadData: {
              first_name: lead.first_name,
              last_name: lead.last_name,
              company: lead.company,
              linkedin_url: lead.linkedin_url,
            },
          });

          const sendResult: SendAllResult = {
            lead_id: lead.lead_id,
            linkedin_url: lead.linkedin_url,
            success: result.success,
            channel: result.channel,
            error: result.error,
            error_code: result.errorCode,
          };

          if (result.success && result.channel) {
            if (result.channel === 'linkedin_message') {
              linkedinMessageSent++;
            } else if (result.channel === 'salesnav_inmail') {
              salesnavInmailSent++;
            }
          }

          return sendResult;
        })
      );

      results.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (i + concurrency < leads.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      total: leads.length,
      sent,
      failed,
      linkedinMessageSent,
      salesnavInmailSent,
      results,
    };
  }
}

export const messageService = new MessageService();
