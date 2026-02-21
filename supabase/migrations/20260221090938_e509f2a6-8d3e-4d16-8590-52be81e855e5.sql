
-- ═══════════════════════════════════
-- USER ROLES (separate from profiles per security requirements)
-- ═══════════════════════════════════
CREATE TYPE public.app_role AS ENUM ('customer', 'agent', 'merchant', 'distributor', 'super_distributor', 'admin', 'compliance', 'finance');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can see own roles, admins can see all
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════
-- AGENTS
-- ═══════════════════════════════════
CREATE TYPE public.agent_status AS ENUM ('pending', 'active', 'suspended', 'terminated');

CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  distributor_id UUID,
  business_name TEXT,
  territory_code TEXT,
  nid_number TEXT,
  trade_license TEXT,
  status agent_status NOT NULL DEFAULT 'pending',
  max_float NUMERIC(15,2) NOT NULL DEFAULT 500000,
  commission_earned NUMERIC(15,2) NOT NULL DEFAULT 0,
  customers_onboarded INT NOT NULL DEFAULT 0,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own record"
  ON public.agents FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage agents"
  ON public.agents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can update own record"
  ON public.agents FOR UPDATE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════
-- MERCHANTS
-- ═══════════════════════════════════
CREATE TYPE public.merchant_category AS ENUM ('retail', 'restaurant', 'grocery', 'pharmacy', 'transport', 'education', 'utility', 'other');

CREATE TABLE public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  category merchant_category NOT NULL DEFAULT 'retail',
  trade_license TEXT,
  bank_account_number TEXT,
  bank_name TEXT,
  bank_routing TEXT,
  mdr_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0150,
  settlement_frequency TEXT NOT NULL DEFAULT 'T+1',
  qr_code_data TEXT,
  status agent_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own record"
  ON public.merchants FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage merchants"
  ON public.merchants FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════
-- DISTRIBUTORS
-- ═══════════════════════════════════
CREATE TABLE public.distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  parent_id UUID REFERENCES public.distributors(id),
  business_name TEXT NOT NULL,
  territory TEXT[],
  max_float NUMERIC(15,2) NOT NULL DEFAULT 10000000,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0020,
  status agent_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Distributors can view own record"
  ON public.distributors FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage distributors"
  ON public.distributors FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════
-- FEE CONFIGURATION
-- ═══════════════════════════════════
CREATE TABLE public.fee_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_type TEXT NOT NULL,
  min_amount NUMERIC(15,2),
  max_amount NUMERIC(15,2),
  fee_type TEXT NOT NULL DEFAULT 'flat',
  fee_value NUMERIC(10,4) NOT NULL,
  agent_commission NUMERIC(10,4) DEFAULT 0,
  distributor_commission NUMERIC(10,4) DEFAULT 0,
  platform_share NUMERIC(10,4) DEFAULT 0,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fee_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read fee config"
  ON public.fee_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage fee config"
  ON public.fee_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════
-- FRAUD ALERTS
-- ═══════════════════════════════════
CREATE TYPE public.alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.alert_status AS ENUM ('open', 'investigating', 'resolved', 'false_positive');

CREATE TABLE public.fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_id UUID,
  rule_triggered TEXT NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'medium',
  status alert_status NOT NULL DEFAULT 'open',
  details JSONB,
  assigned_to UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and compliance can view fraud alerts"
  ON public.fraud_alerts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance'));

CREATE POLICY "Admin and compliance can manage fraud alerts"
  ON public.fraud_alerts FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance'));

-- ═══════════════════════════════════
-- AUDIT LOGS
-- ═══════════════════════════════════
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and compliance can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compliance'));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

-- ═══════════════════════════════════
-- SEED DEFAULT FEE CONFIG
-- ═══════════════════════════════════
INSERT INTO public.fee_config (txn_type, min_amount, max_amount, fee_type, fee_value, agent_commission, platform_share) VALUES
  ('cashout', 50, 500, 'flat', 5, 4, 1),
  ('cashout', 501, 1000, 'flat', 10, 8, 2),
  ('cashout', 1001, 5000, 'flat', 15, 12, 3),
  ('cashout', 5001, 10000, 'flat', 20, 16, 4),
  ('cashout', 10001, 25000, 'flat', 25, 20, 5),
  ('send', 0, 25000, 'flat', 0, 0, 0),
  ('payment', 0, 100000, 'percentage', 0.015, 0, 0.015),
  ('recharge', 0, 5000, 'percentage', 0.02, 0, 0.02),
  ('paybill', 0, 50000, 'percentage', 0.01, 0, 0.01);

-- Enable realtime for fraud_alerts (compliance needs live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.fraud_alerts;
