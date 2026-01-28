-- =====================================================
-- CADENCE AUTOMATOR - COMPLETE SCHEMA MIGRATION
-- =====================================================
-- This migration replaces the initial schema with the
-- complete 14-table design for the cadence platform.
-- =====================================================

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS public.execution_logs CASCADE;
DROP TABLE IF EXISTS public.pending_connect_sessions CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.unipile_accounts CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop existing triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.cleanup_expired_sessions();
DROP FUNCTION IF EXISTS public.update_updated_at();

-- =====================================================
-- 1. PROFILES - User profiles linked to auth.users
-- =====================================================
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  unipile_account_id TEXT, -- ID de cuenta Unipile/LinkedIn conectada
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 2. LEADS - Prospects/contacts to be contacted
-- =====================================================
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  linkedin_url TEXT,
  company TEXT,
  title TEXT,
  phone TEXT,
  timezone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. CADENCES - Outreach sequences
-- =====================================================
CREATE TABLE public.cadences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. CADENCE_STEPS - Steps within each cadence
-- =====================================================
CREATE TABLE public.cadence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  step_type TEXT NOT NULL CHECK (step_type IN (
    'send_email',
    'linkedin_message',
    'linkedin_like',
    'linkedin_connect',
    'linkedin_comment',
    'whatsapp_message',
    'call_manual'
  )),
  step_label TEXT,
  day_offset INTEGER DEFAULT 0,
  order_in_day INTEGER DEFAULT 1,
  config_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. CADENCE_LEADS - Leads assigned to cadences (pivot)
-- =====================================================
CREATE TABLE public.cadence_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES public.cadence_steps(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'active', 'pending', 'generated', 'sent', 'failed', 'paused', 'scheduled', 'completed'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cadence_id, lead_id)
);

-- =====================================================
-- 6. LEAD_STEP_INSTANCES - Step execution state per lead
-- =====================================================
CREATE TABLE public.lead_step_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  cadence_step_id UUID NOT NULL REFERENCES public.cadence_steps(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'sent', 'failed', 'skipped')),
  draft_json JSONB,
  message_template_text TEXT,
  message_rendered_text TEXT,
  payload_snapshot JSONB,
  result_snapshot JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. SCHEDULES - Scheduled future executions
-- =====================================================
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id UUID REFERENCES public.cadences(id) ON DELETE CASCADE,
  cadence_step_id UUID REFERENCES public.cadence_steps(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'executed', 'canceled', 'skipped_due_to_state_change', 'failed'
  )),
  message_template_text TEXT,
  message_rendered_text TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. TEMPLATES - Reusable message templates
-- =====================================================
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN (
    'send_email',
    'linkedin_message',
    'linkedin_like',
    'linkedin_connect',
    'linkedin_comment',
    'whatsapp_message',
    'call_manual'
  )),
  subject_template TEXT,
  body_template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. LINKEDIN_CONVERSATIONS - LinkedIn thread tracking
-- =====================================================
CREATE TABLE public.linkedin_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  linkedin_thread_id TEXT,
  status TEXT DEFAULT 'not_messaged' CHECK (status IN ('not_messaged', 'messaged', 'replied')),
  last_activity_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 10. LINKEDIN_MESSAGES - Individual LinkedIn messages
-- =====================================================
CREATE TABLE public.linkedin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.linkedin_conversations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  body TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  provider TEXT DEFAULT 'unipile',
  provider_message_id TEXT,
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 11. EMAIL_MESSAGES - Email tracking (future support)
-- =====================================================
CREATE TABLE public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID UNIQUE DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  cadence_id UUID REFERENCES public.cadences(id) ON DELETE SET NULL,
  cadence_step_id UUID REFERENCES public.cadence_steps(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  html_body_original TEXT,
  html_body_tracked TEXT,
  gmail_message_id TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 12. EMAIL_EVENTS - Email open/click tracking
-- =====================================================
CREATE TABLE public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.email_messages(event_id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  cadence_id UUID REFERENCES public.cadences(id) ON DELETE SET NULL,
  cadence_step_id UUID REFERENCES public.cadence_steps(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'opened', 'clicked', 'failed')),
  link_url TEXT,
  link_label TEXT,
  user_agent TEXT,
  ip_address TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 13. ACTIVITY_LOG - Complete audit trail
-- =====================================================
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  cadence_id UUID REFERENCES public.cadences(id) ON DELETE SET NULL,
  cadence_step_id UUID REFERENCES public.cadence_steps(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'failed')),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 14. WEEKLY_MESSAGE_STATS - Rate limiting tracking
-- =====================================================
CREATE TABLE public.weekly_message_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  linkedin_sent INTEGER DEFAULT 0,
  sales_navigator_sent INTEGER DEFAULT 0,
  sales_navigator_credit_errors INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, week_start)
);

-- =====================================================
-- INDEXES for performance
-- =====================================================

-- Leads
CREATE INDEX idx_leads_owner ON public.leads(owner_id);
CREATE INDEX idx_leads_linkedin_url ON public.leads(linkedin_url);

-- Cadences
CREATE INDEX idx_cadences_owner ON public.cadences(owner_id);
CREATE INDEX idx_cadences_status ON public.cadences(status);

-- Cadence Steps
CREATE INDEX idx_cadence_steps_cadence ON public.cadence_steps(cadence_id);
CREATE INDEX idx_cadence_steps_owner ON public.cadence_steps(owner_id);

-- Cadence Leads
CREATE INDEX idx_cadence_leads_cadence ON public.cadence_leads(cadence_id);
CREATE INDEX idx_cadence_leads_lead ON public.cadence_leads(lead_id);
CREATE INDEX idx_cadence_leads_status ON public.cadence_leads(status);

-- Lead Step Instances
CREATE INDEX idx_lead_step_instances_cadence ON public.lead_step_instances(cadence_id);
CREATE INDEX idx_lead_step_instances_lead ON public.lead_step_instances(lead_id);
CREATE INDEX idx_lead_step_instances_step ON public.lead_step_instances(cadence_step_id);
CREATE INDEX idx_lead_step_instances_status ON public.lead_step_instances(status);

-- Schedules
CREATE INDEX idx_schedules_scheduled_at ON public.schedules(scheduled_at);
CREATE INDEX idx_schedules_status ON public.schedules(status);
CREATE INDEX idx_schedules_owner ON public.schedules(owner_id);

-- Templates
CREATE INDEX idx_templates_owner ON public.templates(owner_id);
CREATE INDEX idx_templates_step_type ON public.templates(step_type);

-- LinkedIn Conversations
CREATE INDEX idx_linkedin_conversations_owner ON public.linkedin_conversations(owner_id);
CREATE INDEX idx_linkedin_conversations_lead ON public.linkedin_conversations(lead_id);
CREATE INDEX idx_linkedin_conversations_thread ON public.linkedin_conversations(linkedin_thread_id);

-- LinkedIn Messages
CREATE INDEX idx_linkedin_messages_conversation ON public.linkedin_messages(conversation_id);
CREATE INDEX idx_linkedin_messages_owner ON public.linkedin_messages(owner_id);

-- Activity Log
CREATE INDEX idx_activity_log_owner ON public.activity_log(owner_id);
CREATE INDEX idx_activity_log_cadence ON public.activity_log(cadence_id);
CREATE INDEX idx_activity_log_lead ON public.activity_log(lead_id);
CREATE INDEX idx_activity_log_created ON public.activity_log(created_at DESC);

-- Weekly Stats
CREATE INDEX idx_weekly_stats_owner ON public.weekly_message_stats(owner_id);
CREATE INDEX idx_weekly_stats_week ON public.weekly_message_stats(week_start);

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_cadences_updated_at
  BEFORE UPDATE ON public.cadences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_cadence_steps_updated_at
  BEFORE UPDATE ON public.cadence_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_cadence_leads_updated_at
  BEFORE UPDATE ON public.cadence_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_lead_step_instances_updated_at
  BEFORE UPDATE ON public.lead_step_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_linkedin_conversations_updated_at
  BEFORE UPDATE ON public.linkedin_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_weekly_stats_updated_at
  BEFORE UPDATE ON public.weekly_message_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_step_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_message_stats ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Leads policies
CREATE POLICY "Users can manage own leads" ON public.leads
  FOR ALL USING (auth.uid() = owner_id);

-- Cadences policies
CREATE POLICY "Users can manage own cadences" ON public.cadences
  FOR ALL USING (auth.uid() = owner_id);

-- Cadence Steps policies
CREATE POLICY "Users can manage own cadence steps" ON public.cadence_steps
  FOR ALL USING (auth.uid() = owner_id);

-- Cadence Leads policies
CREATE POLICY "Users can manage own cadence leads" ON public.cadence_leads
  FOR ALL USING (auth.uid() = owner_id);

-- Lead Step Instances policies
CREATE POLICY "Users can manage own step instances" ON public.lead_step_instances
  FOR ALL USING (auth.uid() = owner_id);

-- Schedules policies
CREATE POLICY "Users can manage own schedules" ON public.schedules
  FOR ALL USING (auth.uid() = owner_id);

-- Templates policies
CREATE POLICY "Users can manage own templates" ON public.templates
  FOR ALL USING (auth.uid() = owner_id);

-- LinkedIn Conversations policies
CREATE POLICY "Users can manage own conversations" ON public.linkedin_conversations
  FOR ALL USING (auth.uid() = owner_id);

-- LinkedIn Messages policies
CREATE POLICY "Users can manage own messages" ON public.linkedin_messages
  FOR ALL USING (auth.uid() = owner_id);

-- Email Messages policies
CREATE POLICY "Users can manage own email messages" ON public.email_messages
  FOR ALL USING (auth.uid() = owner_user_id);

-- Email Events policies
CREATE POLICY "Users can manage own email events" ON public.email_events
  FOR ALL USING (auth.uid() = owner_user_id);

-- Activity Log policies (read-only for users, service can insert)
CREATE POLICY "Users can view own activity" ON public.activity_log
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Service can insert activity" ON public.activity_log
  FOR INSERT WITH CHECK (true);

-- Weekly Stats policies
CREATE POLICY "Users can manage own stats" ON public.weekly_message_stats
  FOR ALL USING (auth.uid() = owner_id);

-- =====================================================
-- DONE
-- =====================================================
