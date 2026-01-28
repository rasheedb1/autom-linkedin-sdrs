-- Cadence Automator Database Schema
-- Run this migration in your Supabase SQL editor

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Unipile connected accounts
CREATE TABLE IF NOT EXISTS public.unipile_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'LINKEDIN',
  unipile_account_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Pending connection sessions (for state mapping during OAuth flow)
CREATE TABLE IF NOT EXISTS public.pending_connect_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'LINKEDIN',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  linkedin_url TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  provider_internal_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Execution logs for tracking all actions
CREATE TABLE IF NOT EXISTS public.execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id),
  status TEXT NOT NULL,
  channel TEXT,
  request_id TEXT,
  error_code TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_unipile_accounts_user ON public.unipile_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_unipile_accounts_unipile_id ON public.unipile_accounts(unipile_account_id);
CREATE INDEX IF NOT EXISTS idx_leads_user ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_linkedin_url ON public.leads(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_execution_logs_user ON public.execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_action ON public.execution_logs(action);
CREATE INDEX IF NOT EXISTS idx_execution_logs_created ON public.execution_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_sessions_state ON public.pending_connect_sessions(state);
CREATE INDEX IF NOT EXISTS idx_pending_sessions_expires ON public.pending_connect_sessions(expires_at);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unipile_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_connect_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for unipile_accounts
DROP POLICY IF EXISTS "Users can view own accounts" ON public.unipile_accounts;
CREATE POLICY "Users can view own accounts" ON public.unipile_accounts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own accounts" ON public.unipile_accounts;
CREATE POLICY "Users can insert own accounts" ON public.unipile_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own accounts" ON public.unipile_accounts;
CREATE POLICY "Users can update own accounts" ON public.unipile_accounts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own accounts" ON public.unipile_accounts;
CREATE POLICY "Users can delete own accounts" ON public.unipile_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for leads
DROP POLICY IF EXISTS "Users can manage own leads" ON public.leads;
CREATE POLICY "Users can manage own leads" ON public.leads
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for execution_logs (read-only for users, service role can insert)
DROP POLICY IF EXISTS "Users can view own logs" ON public.execution_logs;
CREATE POLICY "Users can view own logs" ON public.execution_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Service role bypass for execution_logs inserts (handled by service_role key)
DROP POLICY IF EXISTS "Service can insert logs" ON public.execution_logs;
CREATE POLICY "Service can insert logs" ON public.execution_logs
  FOR INSERT WITH CHECK (true);

-- RLS Policies for pending_connect_sessions
DROP POLICY IF EXISTS "Users can manage own sessions" ON public.pending_connect_sessions;
CREATE POLICY "Users can manage own sessions" ON public.pending_connect_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Function to clean up expired sessions (run via cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.pending_connect_sessions
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for unipile_accounts updated_at
DROP TRIGGER IF EXISTS update_unipile_accounts_updated_at ON public.unipile_accounts;
CREATE TRIGGER update_unipile_accounts_updated_at
  BEFORE UPDATE ON public.unipile_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
