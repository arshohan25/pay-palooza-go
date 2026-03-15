
-- 1. Add master_distributor_commission to fee_config
ALTER TABLE public.fee_config ADD COLUMN IF NOT EXISTS master_distributor_commission numeric DEFAULT 0;

-- 2. Create commission_tiers table
CREATE TABLE public.commission_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_config_id uuid REFERENCES public.fee_config(id) ON DELETE CASCADE,
  min_amount numeric NOT NULL DEFAULT 0,
  max_amount numeric,
  agent_rate numeric NOT NULL DEFAULT 0,
  distributor_rate numeric NOT NULL DEFAULT 0,
  master_distributor_rate numeric NOT NULL DEFAULT 0,
  company_rate numeric GENERATED ALWAYS AS (
    CASE WHEN (agent_rate + distributor_rate + master_distributor_rate) > 0
    THEN GREATEST(0, 11.90 - agent_rate - distributor_rate - master_distributor_rate)
    ELSE 0 END
  ) STORED,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage commission tiers"
  ON public.commission_tiers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read active tiers"
  ON public.commission_tiers FOR SELECT TO authenticated
  USING (is_active = true);

-- 3. Create commission_logs table
CREATE TABLE public.commission_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id),
  txn_type text NOT NULL,
  txn_amount numeric NOT NULL,
  total_fee numeric NOT NULL DEFAULT 0,
  agent_id uuid,
  agent_amount numeric NOT NULL DEFAULT 0,
  distributor_id uuid,
  distributor_amount numeric NOT NULL DEFAULT 0,
  master_distributor_id uuid,
  master_distributor_amount numeric NOT NULL DEFAULT 0,
  company_amount numeric NOT NULL DEFAULT 0,
  tier_id uuid REFERENCES public.commission_tiers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage commission logs"
  ON public.commission_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Create calculate_commission RPC
CREATE OR REPLACE FUNCTION public.calculate_commission(
  p_txn_type text,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee_rule RECORD;
  v_tier RECORD;
  v_total_fee numeric := 0;
  v_agent numeric := 0;
  v_distributor numeric := 0;
  v_md numeric := 0;
  v_company numeric := 0;
  v_per_thousand numeric;
BEGIN
  -- Find matching fee rule
  SELECT * INTO v_fee_rule
  FROM fee_config
  WHERE txn_type = p_txn_type
    AND is_active = true
    AND (min_amount IS NULL OR p_amount >= min_amount)
    AND (max_amount IS NULL OR p_amount <= max_amount)
  ORDER BY min_amount DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'total_fee', 0, 'agent', 0, 'distributor', 0,
      'master_distributor', 0, 'company', 0, 'tier_id', null
    );
  END IF;

  -- Calculate total fee
  IF v_fee_rule.fee_type = 'percentage' THEN
    v_total_fee := ROUND(p_amount * v_fee_rule.fee_value / 100, 2);
  ELSE
    v_total_fee := v_fee_rule.fee_value;
  END IF;

  -- Try to find a matching commission tier
  SELECT * INTO v_tier
  FROM commission_tiers
  WHERE fee_config_id = v_fee_rule.id
    AND is_active = true
    AND p_amount >= min_amount
    AND (max_amount IS NULL OR p_amount <= max_amount)
  LIMIT 1;

  IF FOUND THEN
    -- Use tier-based per-1000 rates
    v_per_thousand := p_amount / 1000.0;
    v_agent := ROUND(v_tier.agent_rate * v_per_thousand, 2);
    v_distributor := ROUND(v_tier.distributor_rate * v_per_thousand, 2);
    v_md := ROUND(v_tier.master_distributor_rate * v_per_thousand, 2);
  ELSE
    -- Fallback to percentage-based from fee_config
    v_agent := ROUND(p_amount * COALESCE(v_fee_rule.agent_commission, 0) / 100, 2);
    v_distributor := ROUND(p_amount * COALESCE(v_fee_rule.distributor_commission, 0) / 100, 2);
    v_md := ROUND(p_amount * COALESCE(v_fee_rule.master_distributor_commission, 0) / 100, 2);
  END IF;

  -- Company gets the remainder
  v_company := GREATEST(0, v_total_fee - v_agent - v_distributor - v_md);

  RETURN jsonb_build_object(
    'total_fee', v_total_fee,
    'agent', v_agent,
    'distributor', v_distributor,
    'master_distributor', v_md,
    'company', v_company,
    'tier_id', v_tier.id
  );
END;
$$;

-- Enable realtime for commission_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_tiers;
