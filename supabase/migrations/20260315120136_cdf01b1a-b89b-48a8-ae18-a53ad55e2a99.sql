
-- Settlements table for merchant/agent batch payouts
CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('merchant', 'agent')),
  entity_id uuid NOT NULL,
  entity_name text,
  entity_phone text,
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  txn_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  bank_name text,
  bank_account text,
  settlement_ref text,
  notes text,
  settled_by uuid,
  settled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settlements" ON public.settlements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Promo codes table
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL DEFAULT 'flat' CHECK (discount_type IN ('flat', 'percent')),
  discount_value numeric NOT NULL DEFAULT 0,
  min_amount numeric DEFAULT 0,
  max_discount numeric,
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  applies_to text DEFAULT 'all',
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage promo codes" ON public.promo_codes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read active promo codes" ON public.promo_codes
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Cashback rules table
CREATE TABLE public.cashback_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  txn_type text NOT NULL,
  min_amount numeric DEFAULT 0,
  max_amount numeric,
  cashback_type text NOT NULL DEFAULT 'flat' CHECK (cashback_type IN ('flat', 'percent')),
  cashback_value numeric NOT NULL DEFAULT 0,
  max_cashback numeric,
  daily_limit integer DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cashback_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cashback rules" ON public.cashback_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read active cashback rules" ON public.cashback_rules
  FOR SELECT TO authenticated
  USING (is_active = true);
