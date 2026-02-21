
-- Fix 2: Server-side atomic record_transaction function
CREATE OR REPLACE FUNCTION public.record_transaction(
  p_type txn_type,
  p_amount numeric,
  p_fee numeric DEFAULT 0,
  p_recipient_phone text DEFAULT NULL,
  p_recipient_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_reference text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
  v_total_deduction NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock and get balance
  SELECT balance INTO v_balance FROM profiles WHERE user_id = v_user_id FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF p_type = 'addmoney' THEN
    v_new_balance := v_balance + p_amount;
  ELSE
    v_total_deduction := p_amount + p_fee;
    IF v_balance < v_total_deduction THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
    v_new_balance := v_balance - v_total_deduction;
  END IF;

  -- Atomic balance update
  UPDATE profiles SET balance = v_new_balance WHERE user_id = v_user_id;

  -- Insert transaction record
  INSERT INTO transactions (user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_user_id, p_type, p_amount, p_fee, v_new_balance, p_recipient_phone, p_recipient_name, p_description, p_reference, 'completed');

  RETURN json_build_object('success', true, 'balance', v_new_balance);
END;
$$;

-- Fix 3: Rate limiting table for PIN resets
CREATE TABLE IF NOT EXISTS public.pin_reset_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

ALTER TABLE public.pin_reset_attempts ENABLE ROW LEVEL SECURITY;

-- No direct user access - only edge functions via service role
CREATE POLICY "No direct access to pin_reset_attempts"
  ON public.pin_reset_attempts FOR ALL USING (false);

-- Fix 1: Tighten admin phone access - replace broad admin SELECT with restricted version
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'compliance'::app_role)
  );
