import type { SupabaseClient } from '@supabase/supabase-js';

export interface Template {
  id: string;
  owner_id: string;
  name: string;
  step_type: string;
  subject_template: string | null;
  body_template: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  step_type: string;
  subject_template?: string | null;
  body_template: string;
}

export interface UpdateTemplateInput {
  name?: string;
  step_type?: string;
  subject_template?: string | null;
  body_template?: string;
}

export class TemplateService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get all templates for a user
   */
  async getTemplates(ownerId: string): Promise<Template[]> {
    const { data, error } = await this.supabase
      .from('templates')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get templates: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(ownerId: string, templateId: string): Promise<Template | null> {
    const { data, error } = await this.supabase
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .eq('owner_id', ownerId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get template: ${error.message}`);
    }

    return data;
  }

  /**
   * Get templates by step type
   */
  async getTemplatesByType(ownerId: string, stepType: string): Promise<Template[]> {
    const { data, error } = await this.supabase
      .from('templates')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('step_type', stepType)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to get templates by type: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a new template
   */
  async createTemplate(ownerId: string, input: CreateTemplateInput): Promise<Template> {
    const { data, error } = await this.supabase
      .from('templates')
      .insert({
        owner_id: ownerId,
        name: input.name,
        step_type: input.step_type,
        subject_template: input.subject_template || null,
        body_template: input.body_template,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a template
   */
  async updateTemplate(
    ownerId: string,
    templateId: string,
    input: UpdateTemplateInput
  ): Promise<Template | null> {
    // First check if template exists and belongs to user
    const existing = await this.getTemplate(ownerId, templateId);
    if (!existing) {
      return null;
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.step_type !== undefined) updateData.step_type = input.step_type;
    if (input.subject_template !== undefined) updateData.subject_template = input.subject_template;
    if (input.body_template !== undefined) updateData.body_template = input.body_template;

    const { data, error } = await this.supabase
      .from('templates')
      .update(updateData)
      .eq('id', templateId)
      .eq('owner_id', ownerId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(ownerId: string, templateId: string): Promise<boolean> {
    // First check if template exists and belongs to user
    const existing = await this.getTemplate(ownerId, templateId);
    if (!existing) {
      return false;
    }

    const { error } = await this.supabase
      .from('templates')
      .delete()
      .eq('id', templateId)
      .eq('owner_id', ownerId);

    if (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }

    return true;
  }

  /**
   * Render a template with lead data
   */
  renderTemplate(template: string, leadData: Record<string, string | null | undefined>): string {
    let rendered = template;

    // Replace {{variable}} patterns with lead data
    const variables = [
      'first_name',
      'last_name',
      'email',
      'company',
      'title',
      'linkedin_url',
      'phone',
    ];

    for (const variable of variables) {
      const regex = new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`, 'gi');
      rendered = rendered.replace(regex, leadData[variable] || '');
    }

    // Clean up any remaining unreplaced variables
    rendered = rendered.replace(/\{\{\s*\w+\s*\}\}/g, '');

    return rendered.trim();
  }
}
