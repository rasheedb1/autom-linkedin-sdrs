// =====================================================
// DATABASE TYPES - Match Supabase schema exactly
// =====================================================

// Profile (linked to auth.users)
export interface Profile {
  user_id: string;
  full_name: string | null;
  unipile_account_id: string | null;
  created_at: string;
}

// Lead
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

export interface LeadInsert {
  owner_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  company?: string | null;
  title?: string | null;
  phone?: string | null;
  timezone?: string | null;
}

export interface LeadUpdate {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  company?: string | null;
  title?: string | null;
  phone?: string | null;
  timezone?: string | null;
}

// Cadence
export type CadenceStatus = 'draft' | 'active';

export interface Cadence {
  id: string;
  owner_id: string;
  name: string;
  status: CadenceStatus;
  created_at: string;
  updated_at: string;
}

export interface CadenceInsert {
  owner_id: string;
  name: string;
  status?: CadenceStatus;
}

export interface CadenceUpdate {
  name?: string;
  status?: CadenceStatus;
}

// Cadence Step
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

export interface CadenceStepInsert {
  cadence_id: string;
  owner_id: string;
  step_type: StepType;
  step_label?: string | null;
  day_offset?: number;
  order_in_day?: number;
  config_json?: Record<string, unknown> | null;
}

export interface CadenceStepUpdate {
  step_type?: StepType;
  step_label?: string | null;
  day_offset?: number;
  order_in_day?: number;
  config_json?: Record<string, unknown> | null;
}

// Cadence Lead (pivot table)
export type CadenceLeadStatus =
  | 'active'
  | 'pending'
  | 'generated'
  | 'sent'
  | 'failed'
  | 'paused'
  | 'scheduled'
  | 'completed';

export interface CadenceLead {
  id: string;
  cadence_id: string;
  lead_id: string;
  owner_id: string;
  current_step_id: string | null;
  status: CadenceLeadStatus;
  created_at: string;
  updated_at: string;
}

export interface CadenceLeadInsert {
  cadence_id: string;
  lead_id: string;
  owner_id: string;
  current_step_id?: string | null;
  status?: CadenceLeadStatus;
}

// Lead Step Instance
export type StepInstanceStatus = 'pending' | 'generated' | 'sent' | 'failed' | 'skipped';

export interface LeadStepInstance {
  id: string;
  cadence_id: string;
  cadence_step_id: string;
  lead_id: string;
  owner_id: string;
  status: StepInstanceStatus;
  draft_json: Record<string, unknown> | null;
  message_template_text: string | null;
  message_rendered_text: string | null;
  payload_snapshot: Record<string, unknown> | null;
  result_snapshot: Record<string, unknown> | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

// Template
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

export interface TemplateInsert {
  owner_id: string;
  name: string;
  step_type: StepType;
  subject_template?: string | null;
  body_template: string;
}

export interface TemplateUpdate {
  name?: string;
  step_type?: StepType;
  subject_template?: string | null;
  body_template?: string;
}

// Activity Log
export type ActivityStatus = 'ok' | 'failed';

export interface ActivityLog {
  id: string;
  owner_id: string;
  cadence_id: string | null;
  cadence_step_id: string | null;
  lead_id: string | null;
  action: string;
  status: ActivityStatus;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityLogInsert {
  owner_id: string;
  cadence_id?: string | null;
  cadence_step_id?: string | null;
  lead_id?: string | null;
  action: string;
  status: ActivityStatus;
  details?: Record<string, unknown> | null;
}

// Weekly Message Stats
export interface WeeklyMessageStats {
  id: string;
  owner_id: string;
  week_start: string;
  linkedin_sent: number;
  sales_navigator_sent: number;
  sales_navigator_credit_errors: number;
  created_at: string;
  updated_at: string;
}

// LinkedIn Conversation
export type ConversationStatus = 'not_messaged' | 'messaged' | 'replied';

export interface LinkedInConversation {
  id: string;
  owner_id: string;
  lead_id: string | null;
  linkedin_thread_id: string | null;
  status: ConversationStatus;
  last_activity_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// LinkedIn Message
export type MessageDirection = 'inbound' | 'outbound';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface LinkedInMessage {
  id: string;
  conversation_id: string | null;
  owner_id: string;
  body: string | null;
  direction: MessageDirection;
  provider: string;
  provider_message_id: string | null;
  delivery_status: DeliveryStatus;
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

// =====================================================
// EXTENDED TYPES (with joins)
// =====================================================

export interface CadenceWithSteps extends Cadence {
  steps: CadenceStep[];
}

export interface CadenceLeadWithDetails extends CadenceLead {
  lead: Lead;
  current_step: CadenceStep | null;
}

export interface CadenceWithStats extends Cadence {
  total_leads: number;
  active_leads: number;
  completed_leads: number;
  failed_leads: number;
}
