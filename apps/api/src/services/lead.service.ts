import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lead, LeadInsert, LeadUpdate } from '../types/database.js';

export class LeadService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get all leads for a user
   */
  async getLeads(userId: string, options?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ leads: Lead[]; total: number }> {
    let query = this.supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (options?.search) {
      const searchTerm = `%${options.search}%`;
      query = query.or(
        `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},company.ilike.${searchTerm}`
      );
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch leads: ${error.message}`);
    }

    return { leads: data || [], total: count || 0 };
  }

  /**
   * Get a single lead by ID
   */
  async getLead(userId: string, leadId: string): Promise<Lead | null> {
    const { data, error } = await this.supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('owner_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch lead: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new lead
   */
  async createLead(userId: string, lead: Omit<LeadInsert, 'owner_id'>): Promise<Lead> {
    const { data, error } = await this.supabase
      .from('leads')
      .insert({
        ...lead,
        owner_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create lead: ${error.message}`);
    }

    return data;
  }

  /**
   * Create multiple leads (bulk import)
   */
  async createLeads(userId: string, leads: Omit<LeadInsert, 'owner_id'>[]): Promise<Lead[]> {
    const leadsWithOwner = leads.map(lead => ({
      ...lead,
      owner_id: userId,
    }));

    const { data, error } = await this.supabase
      .from('leads')
      .insert(leadsWithOwner)
      .select();

    if (error) {
      throw new Error(`Failed to create leads: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update a lead
   */
  async updateLead(userId: string, leadId: string, updates: LeadUpdate): Promise<Lead> {
    const { data, error } = await this.supabase
      .from('leads')
      .update(updates)
      .eq('id', leadId)
      .eq('owner_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update lead: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a lead
   */
  async deleteLead(userId: string, leadId: string): Promise<void> {
    const { error } = await this.supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('owner_id', userId);

    if (error) {
      throw new Error(`Failed to delete lead: ${error.message}`);
    }
  }

  /**
   * Delete multiple leads
   */
  async deleteLeads(userId: string, leadIds: string[]): Promise<void> {
    const { error } = await this.supabase
      .from('leads')
      .delete()
      .in('id', leadIds)
      .eq('owner_id', userId);

    if (error) {
      throw new Error(`Failed to delete leads: ${error.message}`);
    }
  }

  /**
   * Get leads by LinkedIn URL
   */
  async getLeadByLinkedInUrl(userId: string, linkedinUrl: string): Promise<Lead | null> {
    const { data, error } = await this.supabase
      .from('leads')
      .select('*')
      .eq('owner_id', userId)
      .eq('linkedin_url', linkedinUrl)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch lead: ${error.message}`);
    }

    return data;
  }
}
