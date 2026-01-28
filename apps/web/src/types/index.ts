// Lead types
export interface Lead {
  id: string;
  owner_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  company: string | null;
  title: string | null;
  phone: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadInsert = Omit<Lead, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
export type LeadUpdate = Partial<LeadInsert>;

// Cadence types
export interface Cadence {
  id: string;
  owner_id: string;
  name: string;
  status: 'draft' | 'active';
  created_at: string;
  updated_at: string;
}

export type CadenceInsert = Pick<Cadence, 'name' | 'status'>;
export type CadenceUpdate = Partial<CadenceInsert>;

// Step types
export type StepType =
  | 'send_email'
  | 'linkedin_message'
  | 'linkedin_like'
  | 'linkedin_connect'
  | 'linkedin_comment'
  | 'whatsapp_message'
  | 'call_manual';

export interface CadenceStep {
  id: string;
  cadence_id: string;
  owner_id: string;
  step_type: StepType;
  step_label: string | null;
  day_offset: number;
  order_in_day: number;
  config_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type CadenceStepInsert = Pick<CadenceStep, 'step_type' | 'step_label' | 'day_offset' | 'order_in_day' | 'config_json'>;
export type CadenceStepUpdate = Partial<CadenceStepInsert>;

// Cadence Lead (enrollment)
export type CadenceLeadStatus = 'active' | 'pending' | 'generated' | 'sent' | 'failed' | 'paused' | 'scheduled';

export interface CadenceLead {
  id: string;
  cadence_id: string;
  lead_id: string;
  owner_id: string;
  current_step_id: string | null;
  status: CadenceLeadStatus;
  created_at: string;
  updated_at: string;
  lead?: Lead;
  current_step?: CadenceStep;
}

// Cadence with steps
export interface CadenceWithSteps extends Cadence {
  steps: CadenceStep[];
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  error_code?: string;
  message?: string;
  total?: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
}

// Template types
export interface Template {
  id: string;
  owner_id: string;
  name: string;
  step_type: StepType;
  subject_template: string | null;
  body_template: string;
  created_at: string;
  updated_at: string;
}

export type TemplateInsert = Omit<Template, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
export type TemplateUpdate = Partial<TemplateInsert>;

// Activity log types
export interface ActivityLog {
  id: string;
  owner_id: string;
  cadence_id: string | null;
  cadence_step_id: string | null;
  lead_id: string | null;
  action: string;
  status: 'ok' | 'failed';
  details: Record<string, unknown> | null;
  created_at: string;
}
