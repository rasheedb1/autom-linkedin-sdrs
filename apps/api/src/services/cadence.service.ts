import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Cadence,
  CadenceInsert,
  CadenceUpdate,
  CadenceStep,
  CadenceStepInsert,
  CadenceStepUpdate,
  CadenceWithSteps,
  CadenceWithStats,
  CadenceLead,
  CadenceLeadInsert,
  CadenceLeadWithDetails,
  LeadStepInstance,
} from '../types/database.js';

export class CadenceService {
  constructor(private supabase: SupabaseClient) {}

  // =====================================================
  // CADENCE CRUD
  // =====================================================

  /**
   * Get all cadences for a user
   */
  async getCadences(userId: string): Promise<CadenceWithStats[]> {
    const { data: cadences, error } = await this.supabase
      .from('cadences')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch cadences: ${error.message}`);
    }

    // Get stats for each cadence
    const cadencesWithStats: CadenceWithStats[] = await Promise.all(
      (cadences || []).map(async (cadence) => {
        const { data: leads } = await this.supabase
          .from('cadence_leads')
          .select('status')
          .eq('cadence_id', cadence.id);

        const total = leads?.length || 0;
        const active = leads?.filter(l => l.status === 'active' || l.status === 'pending').length || 0;
        const completed = leads?.filter(l => l.status === 'completed' || l.status === 'sent').length || 0;
        const failed = leads?.filter(l => l.status === 'failed').length || 0;

        return {
          ...cadence,
          total_leads: total,
          active_leads: active,
          completed_leads: completed,
          failed_leads: failed,
        };
      })
    );

    return cadencesWithStats;
  }

  /**
   * Get a single cadence with its steps
   */
  async getCadence(userId: string, cadenceId: string): Promise<CadenceWithSteps | null> {
    const { data: cadence, error } = await this.supabase
      .from('cadences')
      .select('*')
      .eq('id', cadenceId)
      .eq('owner_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch cadence: ${error.message}`);
    }

    const { data: steps } = await this.supabase
      .from('cadence_steps')
      .select('*')
      .eq('cadence_id', cadenceId)
      .order('day_offset', { ascending: true })
      .order('order_in_day', { ascending: true });

    return {
      ...cadence,
      steps: steps || [],
    };
  }

  /**
   * Create a new cadence
   */
  async createCadence(userId: string, cadence: Omit<CadenceInsert, 'owner_id'>): Promise<Cadence> {
    const { data, error } = await this.supabase
      .from('cadences')
      .insert({
        ...cadence,
        owner_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create cadence: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a cadence
   */
  async updateCadence(userId: string, cadenceId: string, updates: CadenceUpdate): Promise<Cadence> {
    const { data, error } = await this.supabase
      .from('cadences')
      .update(updates)
      .eq('id', cadenceId)
      .eq('owner_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update cadence: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a cadence
   */
  async deleteCadence(userId: string, cadenceId: string): Promise<void> {
    const { error } = await this.supabase
      .from('cadences')
      .delete()
      .eq('id', cadenceId)
      .eq('owner_id', userId);

    if (error) {
      throw new Error(`Failed to delete cadence: ${error.message}`);
    }
  }

  /**
   * Activate a cadence
   */
  async activateCadence(userId: string, cadenceId: string): Promise<Cadence> {
    return this.updateCadence(userId, cadenceId, { status: 'active' });
  }

  /**
   * Pause a cadence (set to draft)
   */
  async pauseCadence(userId: string, cadenceId: string): Promise<Cadence> {
    return this.updateCadence(userId, cadenceId, { status: 'draft' });
  }

  // =====================================================
  // CADENCE STEPS
  // =====================================================

  /**
   * Get steps for a cadence
   */
  async getSteps(userId: string, cadenceId: string): Promise<CadenceStep[]> {
    const { data, error } = await this.supabase
      .from('cadence_steps')
      .select('*')
      .eq('cadence_id', cadenceId)
      .eq('owner_id', userId)
      .order('day_offset', { ascending: true })
      .order('order_in_day', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch steps: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a step
   */
  async createStep(userId: string, cadenceId: string, step: Omit<CadenceStepInsert, 'owner_id' | 'cadence_id'>): Promise<CadenceStep> {
    // Get current max order for the day
    const { data: existingSteps } = await this.supabase
      .from('cadence_steps')
      .select('order_in_day')
      .eq('cadence_id', cadenceId)
      .eq('day_offset', step.day_offset || 0)
      .order('order_in_day', { ascending: false })
      .limit(1);

    const nextOrder = existingSteps?.[0]?.order_in_day
      ? existingSteps[0].order_in_day + 1
      : 1;

    const { data, error } = await this.supabase
      .from('cadence_steps')
      .insert({
        ...step,
        cadence_id: cadenceId,
        owner_id: userId,
        order_in_day: step.order_in_day ?? nextOrder,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create step: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a step
   */
  async updateStep(userId: string, stepId: string, updates: CadenceStepUpdate): Promise<CadenceStep> {
    const { data, error } = await this.supabase
      .from('cadence_steps')
      .update(updates)
      .eq('id', stepId)
      .eq('owner_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update step: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a step
   */
  async deleteStep(userId: string, stepId: string): Promise<void> {
    const { error } = await this.supabase
      .from('cadence_steps')
      .delete()
      .eq('id', stepId)
      .eq('owner_id', userId);

    if (error) {
      throw new Error(`Failed to delete step: ${error.message}`);
    }
  }

  /**
   * Reorder steps
   */
  async reorderSteps(userId: string, cadenceId: string, stepIds: string[]): Promise<CadenceStep[]> {
    // Update each step with its new order
    const updates = stepIds.map((id, index) =>
      this.supabase
        .from('cadence_steps')
        .update({ order_in_day: index + 1 })
        .eq('id', id)
        .eq('owner_id', userId)
        .eq('cadence_id', cadenceId)
    );

    await Promise.all(updates);

    return this.getSteps(userId, cadenceId);
  }

  // =====================================================
  // CADENCE LEADS (Enrollment)
  // =====================================================

  /**
   * Get leads enrolled in a cadence
   */
  async getCadenceLeads(userId: string, cadenceId: string): Promise<CadenceLeadWithDetails[]> {
    const { data, error } = await this.supabase
      .from('cadence_leads')
      .select(`
        *,
        lead:leads(*),
        current_step:cadence_steps(*)
      `)
      .eq('cadence_id', cadenceId)
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch cadence leads: ${error.message}`);
    }

    return (data || []).map(item => ({
      ...item,
      lead: item.lead,
      current_step: item.current_step,
    }));
  }

  /**
   * Enroll leads in a cadence
   */
  async enrollLeads(userId: string, cadenceId: string, leadIds: string[]): Promise<CadenceLead[]> {
    // Get the first step of the cadence
    const { data: firstStep } = await this.supabase
      .from('cadence_steps')
      .select('id')
      .eq('cadence_id', cadenceId)
      .order('day_offset', { ascending: true })
      .order('order_in_day', { ascending: true })
      .limit(1)
      .single();

    const enrollments: CadenceLeadInsert[] = leadIds.map(leadId => ({
      cadence_id: cadenceId,
      lead_id: leadId,
      owner_id: userId,
      current_step_id: firstStep?.id || null,
      status: 'pending',
    }));

    const { data, error } = await this.supabase
      .from('cadence_leads')
      .insert(enrollments)
      .select();

    if (error) {
      throw new Error(`Failed to enroll leads: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Remove a lead from a cadence
   */
  async unenrollLead(userId: string, cadenceId: string, leadId: string): Promise<void> {
    const { error } = await this.supabase
      .from('cadence_leads')
      .delete()
      .eq('cadence_id', cadenceId)
      .eq('lead_id', leadId)
      .eq('owner_id', userId);

    if (error) {
      throw new Error(`Failed to unenroll lead: ${error.message}`);
    }
  }

  /**
   * Pause a lead in a cadence
   */
  async pauseLead(userId: string, cadenceLeadId: string): Promise<CadenceLead> {
    const { data, error } = await this.supabase
      .from('cadence_leads')
      .update({ status: 'paused' })
      .eq('id', cadenceLeadId)
      .eq('owner_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to pause lead: ${error.message}`);
    }

    return data;
  }

  /**
   * Resume a lead in a cadence
   */
  async resumeLead(userId: string, cadenceLeadId: string): Promise<CadenceLead> {
    const { data, error } = await this.supabase
      .from('cadence_leads')
      .update({ status: 'active' })
      .eq('id', cadenceLeadId)
      .eq('owner_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to resume lead: ${error.message}`);
    }

    return data;
  }

  /**
   * Get step instances for a cadence lead
   */
  async getLeadStepInstances(userId: string, cadenceLeadId: string): Promise<LeadStepInstance[]> {
    // First get the cadence_lead to get cadence_id and lead_id
    const { data: cadenceLead } = await this.supabase
      .from('cadence_leads')
      .select('cadence_id, lead_id')
      .eq('id', cadenceLeadId)
      .eq('owner_id', userId)
      .single();

    if (!cadenceLead) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('lead_step_instances')
      .select('*')
      .eq('cadence_id', cadenceLead.cadence_id)
      .eq('lead_id', cadenceLead.lead_id)
      .eq('owner_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch step instances: ${error.message}`);
    }

    return data || [];
  }
}
