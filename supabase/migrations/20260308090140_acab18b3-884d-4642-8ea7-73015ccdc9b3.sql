
-- Global default transaction limits
CREATE TABLE public.transaction_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_type text NOT NULL,
  period text NOT NULL CHECK (period IN ('daily', 'monthly')),
  max_amount numeric NOT NULL DEFAULT 0,
  max_count integer NOT NULL DEFAULT 0,
  applies_to text NOT NULL DEFAULT 'user' CHECK (applies_to IN ('user', 'merchant', 'agent')),
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(txn_type, period, applies_to)
);

ALTER TABLE public.transaction_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage transaction limits"
  ON public.transaction_limits FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read transaction limits"
  ON public.transaction_limits FOR SELECT TO authenticated
  USING (true);

-- Per-user limit overrides
CREATE TABLE public.user_limit_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  txn_type text NOT NULL,
  period text NOT NULL CHECK (period IN ('daily', 'monthly')),
  max_amount numeric,
  max_count integer,
  reason text,
  set_by uuid NOT NULL,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(target_user_id, txn_type, period)
);

ALTER TABLE public.user_limit_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user limit overrides"
  ON public.user_limit_overrides FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own limit overrides"
  ON public.user_limit_overrides FOR SELECT TO authenticated
  USING (auth.uid() = target_user_id);

-- Seed default limits for users (matching current hardcoded values)
INSERT INTO public.transaction_limits (txn_type, period, max_amount, max_count, applies_to) VALUES
  ('send', 'daily', 50000, 40, 'user'),
  ('send', 'monthly', 400000, 100, 'user'),
  ('cashin', 'daily', 50000, 20, 'user'),
  ('cashin', 'monthly', 300000, 100, 'user'),
  ('cashout', 'daily', 35000, 15, 'user'),
  ('cashout', 'monthly', 300000, 100, 'user'),
  ('addmoney', 'daily', 50000, 20, 'user'),
  ('addmoney', 'monthly', 300000, 50, 'user'),
  ('payment', 'daily', 0, 0, 'user'),
  ('payment', 'monthly', 0, 0, 'user'),
  ('recharge', 'daily', 50000, 200, 'user'),
  ('recharge', 'monthly', 300000, 2000, 'user'),
  ('paybill', 'daily', 0, 0, 'user'),
  ('paybill', 'monthly', 0, 0, 'user'),
  ('banktransfer', 'daily', 50000, 40, 'user'),
  ('banktransfer', 'monthly', 400000, 100, 'user'),
  -- Merchant defaults (same as user for now)
  ('send', 'daily', 100000, 100, 'merchant'),
  ('send', 'monthly', 1000000, 500, 'merchant'),
  ('cashout', 'daily', 100000, 50, 'merchant'),
  ('cashout', 'monthly', 500000, 200, 'merchant'),
  ('payment', 'daily', 0, 0, 'merchant'),
  ('payment', 'monthly', 0, 0, 'merchant'),
  -- Agent defaults
  ('cashin', 'daily', 500000, 200, 'agent'),
  ('cashin', 'monthly', 5000000, 2000, 'agent'),
  ('cashout', 'daily', 500000, 200, 'agent'),
  ('cashout', 'monthly', 5000000, 2000, 'agent');
