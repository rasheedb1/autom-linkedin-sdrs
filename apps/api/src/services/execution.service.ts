import { SupabaseClient } from '@supabase/supabase-js';
import { MessageService } from './message.service.js';
import { PostsService } from './posts.service.js';
import type { StepType, CadenceLead, CadenceStep, LeadStepInstance, Lead } from '../types/database.js';

export interface ExecuteStepResult {
  success: boolean;
  stepInstanceId?: string;
  channel?: string;
  requestId?: string;
  error?: string;
  errorCode?: string;
}

export interface BatchExecuteResult {
  total: number;
  executed: number;
  failed: number;
  skipped: number;
  results: Array<{
    cadenceLeadId: string;
    leadId: string;
    stepId: string;
    result: ExecuteStepResult;
  }>;
}

/**
 * Execution Service
 *
 * Handles executing cadence steps for leads, including:
 * - LinkedIn messages (with InMail fallback)
 * - LinkedIn likes
 * - Activity logging
 * - Rate limit tracking
 */
export class ExecutionService {
  private messageService: MessageService;
  private postsService: PostsService;

  constructor(private supabaseAdmin: SupabaseClient) {
    this.messageService = new MessageService(supabaseAdmin);
    this.postsService = new PostsService(supabaseAdmin);
  }

  /**
   * Execute a specific step for a cadence lead
   */
  async executeStep(
    ownerId: string,
    cadenceLeadId: string,
    stepId: string
  ): Promise<ExecuteStepResult> {
    // Get the cadence lead with lead data
    const { data: cadenceLead, error: clError } = await this.supabaseAdmin
      .from('cadence_leads')
      .select(`
        *,
        lead:leads(*)
      `)
      .eq('id', cadenceLeadId)
      .eq('owner_id', ownerId)
      .single();

    if (clError || !cadenceLead) {
      return {
        success: false,
        error: 'Cadence lead not found',
        errorCode: 'NOT_FOUND',
      };
    }

    // Get the step
    const { data: step, error: stepError } = await this.supabaseAdmin
      .from('cadence_steps')
      .select('*')
      .eq('id', stepId)
      .eq('owner_id', ownerId)
      .single();

    if (stepError || !step) {
      return {
        success: false,
        error: 'Step not found',
        errorCode: 'NOT_FOUND',
      };
    }

    const lead = cadenceLead.lead as Lead;

    // Create or update lead_step_instance
    const instance = await this.createOrUpdateStepInstance(
      ownerId,
      cadenceLead.cadence_id,
      stepId,
      lead.id,
      'pending'
    );

    // Execute based on step type
    let result: ExecuteStepResult;

    try {
      result = await this.executeStepAction(ownerId, step, lead, instance);
    } catch (err) {
      result = {
        success: false,
        error: err instanceof Error ? err.message : 'Execution failed',
        errorCode: 'EXECUTION_ERROR',
      };
    }

    // Update step instance with result
    await this.updateStepInstance(instance.id, result);

    // Log activity
    await this.logActivity(ownerId, cadenceLead.cadence_id, stepId, lead.id, step.step_type, result);

    // Update weekly stats if applicable
    if (result.success && (step.step_type === 'linkedin_message' || step.step_type === 'send_email')) {
      await this.updateWeeklyStats(ownerId, result.channel === 'salesnav_inmail' ? 'sales_navigator' : 'linkedin');
    }

    // Advance cadence lead to next step if successful
    if (result.success) {
      await this.advanceCadenceLead(cadenceLeadId, step);
    }

    return {
      ...result,
      stepInstanceId: instance.id,
    };
  }

  /**
   * Execute the next pending step for a cadence lead
   */
  async executeNextStep(ownerId: string, cadenceLeadId: string): Promise<ExecuteStepResult> {
    // Get the cadence lead
    const { data: cadenceLead, error } = await this.supabaseAdmin
      .from('cadence_leads')
      .select('*, cadence:cadences(status)')
      .eq('id', cadenceLeadId)
      .eq('owner_id', ownerId)
      .single();

    if (error || !cadenceLead) {
      return {
        success: false,
        error: 'Cadence lead not found',
        errorCode: 'NOT_FOUND',
      };
    }

    // Check if cadence is active
    if (cadenceLead.cadence?.status !== 'active') {
      return {
        success: false,
        error: 'Cadence is not active',
        errorCode: 'CADENCE_INACTIVE',
      };
    }

    // Check if lead is in executable state
    if (!['pending', 'active'].includes(cadenceLead.status)) {
      return {
        success: false,
        error: `Lead is in ${cadenceLead.status} state`,
        errorCode: 'INVALID_STATE',
      };
    }

    // Get the next step to execute
    const nextStep = await this.getNextStep(cadenceLead);

    if (!nextStep) {
      return {
        success: false,
        error: 'No more steps to execute',
        errorCode: 'NO_NEXT_STEP',
      };
    }

    return this.executeStep(ownerId, cadenceLeadId, nextStep.id);
  }

  /**
   * Execute steps for multiple leads in a cadence (batch)
   */
  async executeBatch(
    ownerId: string,
    cadenceId: string,
    limit = 10
  ): Promise<BatchExecuteResult> {
    // Get pending cadence leads
    const { data: cadenceLeads, error } = await this.supabaseAdmin
      .from('cadence_leads')
      .select('*')
      .eq('cadence_id', cadenceId)
      .eq('owner_id', ownerId)
      .in('status', ['pending', 'active'])
      .limit(limit);

    if (error || !cadenceLeads) {
      return {
        total: 0,
        executed: 0,
        failed: 0,
        skipped: 0,
        results: [],
      };
    }

    const results: BatchExecuteResult['results'] = [];
    let executed = 0;
    let failed = 0;
    let skipped = 0;

    for (const cadenceLead of cadenceLeads) {
      // Get next step
      const nextStep = await this.getNextStep(cadenceLead);

      if (!nextStep) {
        skipped++;
        continue;
      }

      const result = await this.executeStep(ownerId, cadenceLead.id, nextStep.id);

      results.push({
        cadenceLeadId: cadenceLead.id,
        leadId: cadenceLead.lead_id,
        stepId: nextStep.id,
        result,
      });

      if (result.success) {
        executed++;
      } else {
        failed++;
      }

      // Add delay between executions to avoid rate limiting
      await this.delay(2000);
    }

    return {
      total: cadenceLeads.length,
      executed,
      failed,
      skipped,
      results,
    };
  }

  /**
   * Get pending leads for a cadence (ready to execute)
   */
  async getPendingLeads(
    ownerId: string,
    cadenceId: string
  ): Promise<Array<CadenceLead & { lead: Lead; next_step: CadenceStep | null }>> {
    const { data: cadenceLeads } = await this.supabaseAdmin
      .from('cadence_leads')
      .select(`
        *,
        lead:leads(*)
      `)
      .eq('cadence_id', cadenceId)
      .eq('owner_id', ownerId)
      .in('status', ['pending', 'active']);

    if (!cadenceLeads) return [];

    // Get next step for each
    const result = await Promise.all(
      cadenceLeads.map(async (cl) => {
        const nextStep = await this.getNextStep(cl);
        return {
          ...cl,
          next_step: nextStep,
        };
      })
    );

    return result;
  }

  /**
   * Get weekly message stats for rate limiting display
   */
  async getWeeklyStats(ownerId: string): Promise<{
    linkedin_sent: number;
    sales_navigator_sent: number;
    week_start: string;
  }> {
    const weekStart = this.getWeekStart();

    const { data } = await this.supabaseAdmin
      .from('weekly_message_stats')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('week_start', weekStart)
      .single();

    if (!data) {
      return {
        linkedin_sent: 0,
        sales_navigator_sent: 0,
        week_start: weekStart,
      };
    }

    return {
      linkedin_sent: data.linkedin_sent || 0,
      sales_navigator_sent: data.sales_navigator_sent || 0,
      week_start: weekStart,
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async executeStepAction(
    ownerId: string,
    step: CadenceStep,
    lead: Lead,
    instance: LeadStepInstance
  ): Promise<ExecuteStepResult> {
    const stepType = step.step_type as StepType;

    switch (stepType) {
      case 'linkedin_message':
        return this.executeLinkedInMessage(ownerId, step, lead, instance);

      case 'linkedin_like':
        return this.executeLinkedInLike(ownerId, lead);

      case 'linkedin_connect':
        // Connection requests not yet implemented
        return {
          success: false,
          error: 'Connection requests not yet implemented',
          errorCode: 'NOT_IMPLEMENTED',
        };

      case 'linkedin_comment':
        // Comments not yet implemented
        return {
          success: false,
          error: 'Comments not yet implemented',
          errorCode: 'NOT_IMPLEMENTED',
        };

      case 'send_email':
        // Email sending not yet implemented
        return {
          success: false,
          error: 'Email sending not yet implemented',
          errorCode: 'NOT_IMPLEMENTED',
        };

      case 'whatsapp_message':
        return {
          success: false,
          error: 'WhatsApp messaging not yet implemented',
          errorCode: 'NOT_IMPLEMENTED',
        };

      case 'call_manual':
        // Manual call is just a reminder, mark as completed
        return {
          success: true,
          channel: 'manual',
        };

      default:
        return {
          success: false,
          error: `Unknown step type: ${stepType}`,
          errorCode: 'INVALID_STEP_TYPE',
        };
    }
  }

  private async executeLinkedInMessage(
    ownerId: string,
    step: CadenceStep,
    lead: Lead,
    instance: LeadStepInstance
  ): Promise<ExecuteStepResult> {
    if (!lead.linkedin_url) {
      return {
        success: false,
        error: 'Lead has no LinkedIn URL',
        errorCode: 'MISSING_LINKEDIN_URL',
      };
    }

    // Get message template from step config or instance
    const messageTemplate = instance.message_template_text ||
      (step.config_json as { message_template?: string })?.message_template ||
      'Hello {{first_name}}, I wanted to connect with you.';

    const result = await this.messageService.sendMessageWithFallback({
      userId: ownerId,
      leadId: lead.id,
      linkedinUrl: lead.linkedin_url,
      messageBody: messageTemplate,
      leadData: {
        first_name: lead.first_name || undefined,
        last_name: lead.last_name || undefined,
        company: lead.company || undefined,
        linkedin_url: lead.linkedin_url,
      },
    });

    return {
      success: result.success,
      channel: result.channel,
      requestId: result.requestId,
      error: result.error,
      errorCode: result.errorCode,
    };
  }

  private async executeLinkedInLike(
    ownerId: string,
    lead: Lead
  ): Promise<ExecuteStepResult> {
    if (!lead.linkedin_url) {
      return {
        success: false,
        error: 'Lead has no LinkedIn URL',
        errorCode: 'MISSING_LINKEDIN_URL',
      };
    }

    const result = await this.postsService.likeLastPost({
      userId: ownerId,
      leadId: lead.id,
      linkedinUrl: lead.linkedin_url,
    });

    return {
      success: result.success,
      channel: 'linkedin_like',
      requestId: result.requestId,
      error: result.error,
      errorCode: result.errorCode,
    };
  }

  private async getNextStep(cadenceLead: CadenceLead): Promise<CadenceStep | null> {
    // Get all steps for this cadence, ordered
    const { data: steps } = await this.supabaseAdmin
      .from('cadence_steps')
      .select('*')
      .eq('cadence_id', cadenceLead.cadence_id)
      .order('day_offset', { ascending: true })
      .order('order_in_day', { ascending: true });

    if (!steps || steps.length === 0) return null;

    // Get completed step instances for this lead
    const { data: completedInstances } = await this.supabaseAdmin
      .from('lead_step_instances')
      .select('cadence_step_id')
      .eq('cadence_id', cadenceLead.cadence_id)
      .eq('lead_id', cadenceLead.lead_id)
      .eq('status', 'sent');

    const completedStepIds = new Set(completedInstances?.map(i => i.cadence_step_id) || []);

    // Find first step not yet completed
    return steps.find(step => !completedStepIds.has(step.id)) || null;
  }

  private async createOrUpdateStepInstance(
    ownerId: string,
    cadenceId: string,
    stepId: string,
    leadId: string,
    status: string
  ): Promise<LeadStepInstance> {
    // Check if instance exists
    const { data: existing } = await this.supabaseAdmin
      .from('lead_step_instances')
      .select('*')
      .eq('cadence_id', cadenceId)
      .eq('cadence_step_id', stepId)
      .eq('lead_id', leadId)
      .single();

    if (existing) {
      const { data: updated } = await this.supabaseAdmin
        .from('lead_step_instances')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      return updated!;
    }

    // Create new instance
    const { data: created } = await this.supabaseAdmin
      .from('lead_step_instances')
      .insert({
        cadence_id: cadenceId,
        cadence_step_id: stepId,
        lead_id: leadId,
        owner_id: ownerId,
        status,
      })
      .select()
      .single();

    return created!;
  }

  private async updateStepInstance(
    instanceId: string,
    result: ExecuteStepResult
  ): Promise<void> {
    const update: Record<string, unknown> = {
      status: result.success ? 'sent' : 'failed',
      updated_at: new Date().toISOString(),
    };

    if (result.success) {
      update.result_snapshot = {
        channel: result.channel,
        request_id: result.requestId,
        executed_at: new Date().toISOString(),
      };
    } else {
      update.last_error = result.error;
      update.result_snapshot = {
        error_code: result.errorCode,
        error: result.error,
        failed_at: new Date().toISOString(),
      };
    }

    await this.supabaseAdmin
      .from('lead_step_instances')
      .update(update)
      .eq('id', instanceId);
  }

  private async advanceCadenceLead(
    cadenceLeadId: string,
    completedStep: CadenceStep
  ): Promise<void> {
    // Update current_step_id and status
    await this.supabaseAdmin
      .from('cadence_leads')
      .update({
        current_step_id: completedStep.id,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', cadenceLeadId);
  }

  private async logActivity(
    ownerId: string,
    cadenceId: string,
    stepId: string,
    leadId: string,
    action: string,
    result: ExecuteStepResult
  ): Promise<void> {
    await this.supabaseAdmin
      .from('activity_log')
      .insert({
        owner_id: ownerId,
        cadence_id: cadenceId,
        cadence_step_id: stepId,
        lead_id: leadId,
        action: `${action}_${result.success ? 'success' : 'failed'}`,
        status: result.success ? 'ok' : 'failed',
        details: {
          channel: result.channel,
          request_id: result.requestId,
          error: result.error,
          error_code: result.errorCode,
        },
      });
  }

  private async updateWeeklyStats(
    ownerId: string,
    channel: 'linkedin' | 'sales_navigator'
  ): Promise<void> {
    const weekStart = this.getWeekStart();

    // Try to increment existing record
    const field = channel === 'linkedin' ? 'linkedin_sent' : 'sales_navigator_sent';

    const { data: existing } = await this.supabaseAdmin
      .from('weekly_message_stats')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('week_start', weekStart)
      .single();

    if (existing) {
      await this.supabaseAdmin
        .from('weekly_message_stats')
        .update({
          [field]: (existing[field] || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await this.supabaseAdmin
        .from('weekly_message_stats')
        .insert({
          owner_id: ownerId,
          week_start: weekStart,
          [field]: 1,
        });
    }
  }

  private getWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
