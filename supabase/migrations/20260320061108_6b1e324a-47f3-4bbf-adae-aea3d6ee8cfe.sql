
-- Create donation_cause_funds table
CREATE TABLE public.donation_cause_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cause_name text UNIQUE NOT NULL,
  cause_icon text,
  balance numeric NOT NULL DEFAULT 0,
  total_raised numeric NOT NULL DEFAULT 0,
  donor_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.donation_cause_funds ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Authenticated users can read cause funds"
ON public.donation_cause_funds FOR SELECT
TO authenticated
USING (true);

-- Admins can do everything
CREATE POLICY "Admins can manage cause funds"
ON public.donation_cause_funds FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update process_donation to upsert cause funds
CREATE OR REPLACE FUNCTION public.process_donation(
  p_amount numeric,
  p_cause_name text,
  p_cause_icon text DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_is_anonymous boolean DEFAULT false,
  p_is_recurring boolean DEFAULT false,
  p_frequency text DEFAULT 'monthly'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
  v_treasury RECORD;
  v_new_treasury_balance NUMERIC;
  v_next_run TIMESTAMPTZ;
  v_reference TEXT;
  v_description TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount < 10 THEN RAISE EXCEPTION 'Minimum donation is ৳10'; END IF;
  IF p_amount > 100000 THEN RAISE EXCEPTION 'Maximum donation is ৳100,000'; END IF;

  v_reference := 'DON-' || upper(replace(p_cause_name, ' ', '-'));
  v_description := 'Donation: ' || p_cause_name || COALESCE(' — ' || p_message, '');

  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_new_balance := v_balance - p_amount;
  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  INSERT INTO transactions (user_id, type, amount, fee, balance_after, description, reference, recipient_name, status)
  VALUES (v_user_id, 'payment', p_amount, 0, v_new_balance, v_description, v_reference, p_cause_name, 'completed');

  INSERT INTO donations (user_id, cause_name, cause_icon, amount, message, is_anonymous)
  VALUES (v_user_id, p_cause_name, p_cause_icon, p_amount, p_message, p_is_anonymous);

  -- Credit platform treasury
  SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
  IF v_treasury.id IS NOT NULL THEN
    v_new_treasury_balance := v_treasury.balance + p_amount;
    UPDATE platform_treasury SET balance = v_new_treasury_balance, total_earnings = total_earnings + p_amount, updated_at = now() WHERE id = v_treasury.id;
    INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description, reference)
    VALUES ('earning', p_amount, v_new_treasury_balance, v_user_id, 'Donation: ' || p_cause_name, v_reference);
  END IF;

  -- Upsert per-cause fund tracking
  INSERT INTO donation_cause_funds (cause_name, cause_icon, balance, total_raised, donor_count, updated_at)
  VALUES (p_cause_name, p_cause_icon, p_amount, p_amount, 1, now())
  ON CONFLICT (cause_name) DO UPDATE SET
    balance = donation_cause_funds.balance + EXCLUDED.balance,
    total_raised = donation_cause_funds.total_raised + EXCLUDED.total_raised,
    donor_count = donation_cause_funds.donor_count + 1,
    cause_icon = COALESCE(EXCLUDED.cause_icon, donation_cause_funds.cause_icon),
    updated_at = now();

  IF p_is_recurring THEN
    v_next_run := now();
    IF p_frequency = 'weekly' THEN
      v_next_run := v_next_run + interval '7 days';
    ELSIF p_frequency = 'yearly' THEN
      v_next_run := v_next_run + interval '1 year';
    ELSE
      v_next_run := v_next_run + interval '1 month';
    END IF;
    INSERT INTO recurring_donations (user_id, cause_name, cause_icon, amount, frequency, message, is_anonymous, next_run_at)
    VALUES (v_user_id, p_cause_name, p_cause_icon, p_amount, p_frequency, p_message, p_is_anonymous, v_next_run);
  END IF;

  RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
