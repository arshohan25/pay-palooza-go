
CREATE OR REPLACE FUNCTION public.agent_cashin(
  p_customer_phone text,
  p_amount numeric,
  p_commission numeric DEFAULT 0,
  p_reference text DEFAULT NULL,
  p_description text DEFAULT 'Agent Cash In'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_agent_balance numeric;
  v_agent_new_balance numeric;
  v_customer RECORD;
  v_customer_new_balance numeric;
  v_agent_commission_new_balance numeric;
  v_agent_txn_id uuid;
  v_customer_txn_id uuid;
  v_treasury RECORD;
  v_new_treasury_balance numeric;
  v_has_other boolean;
BEGIN
  v_agent_id := auth.uid();
  IF v_agent_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM require_kyc_verified(v_agent_id);

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount > 1000000 THEN RAISE EXCEPTION 'Amount exceeds maximum limit'; END IF;
  IF p_commission IS NULL OR p_commission < 0 THEN RAISE EXCEPTION 'Commission cannot be negative'; END IF;
  IF p_customer_phone IS NULL OR LENGTH(p_customer_phone) < 3 THEN RAISE EXCEPTION 'Invalid customer'; END IF;

  -- Lock agent
  SELECT balance INTO v_agent_balance FROM profiles WHERE user_id = v_agent_id FOR UPDATE;
  IF v_agent_balance IS NULL THEN RAISE EXCEPTION 'Agent profile not found'; END IF;
  IF v_agent_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  -- Lock customer
  SELECT user_id, balance, name INTO v_customer FROM profiles WHERE phone = p_customer_phone FOR UPDATE;
  IF v_customer.user_id IS NULL THEN RAISE EXCEPTION 'Customer not found'; END IF;
  IF v_customer.user_id = v_agent_id THEN RAISE EXCEPTION 'Cannot cash-in to yourself'; END IF;

  -- Enforce customer must be a plain user wallet (no elevated roles)
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = v_customer.user_id
      AND role::text IN ('agent','distributor','super_distributor','merchant','admin','moderator')
  ) INTO v_has_other;
  IF v_has_other THEN
    RAISE EXCEPTION 'Cash In allowed only to customer (user) wallets';
  END IF;

  v_agent_new_balance := v_agent_balance - p_amount;
  v_customer_new_balance := v_customer.balance + p_amount;

  UPDATE profiles SET balance = v_agent_new_balance WHERE user_id = v_agent_id;
  UPDATE profiles SET balance = v_customer_new_balance WHERE user_id = v_customer.user_id;

  -- Credit agent commission from treasury
  IF p_commission > 0 THEN
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance - p_commission;
      UPDATE platform_treasury
        SET balance = v_new_treasury_balance,
            total_commissions_paid = total_commissions_paid + p_commission,
            updated_at = now()
        WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, counterparty_role, description, reference)
      VALUES ('commission_paid', p_commission, v_new_treasury_balance, v_agent_id, 'agent', 'Cash In commission', p_reference);
    END IF;
    -- Credit commission to agent balance
    v_agent_commission_new_balance := v_agent_new_balance + p_commission;
    UPDATE profiles SET balance = v_agent_commission_new_balance WHERE user_id = v_agent_id;
    v_agent_new_balance := v_agent_commission_new_balance;
  END IF;

  v_agent_txn_id := gen_random_uuid();
  v_customer_txn_id := gen_random_uuid();

  -- Agent row: outbound cash-in (debit) with commission earned recorded
  INSERT INTO transactions (id, user_id, type, amount, fee, commission, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_agent_txn_id, v_agent_id, 'cashin'::txn_type, p_amount, 0, p_commission, v_agent_new_balance,
    p_customer_phone, v_customer.name, p_description, p_reference, 'completed');

  -- Customer row: inbound cash-in (credit), no commission
  INSERT INTO transactions (id, user_id, type, amount, fee, commission, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_customer_txn_id, v_customer.user_id, 'cashin'::txn_type, p_amount, 0, 0, v_customer_new_balance,
    (SELECT phone FROM profiles WHERE user_id = v_agent_id),
    (SELECT name FROM profiles WHERE user_id = v_agent_id),
    p_description, p_reference, 'completed');

  RETURN json_build_object('success', true, 'agent_balance', v_agent_new_balance, 'reference', p_reference);
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_cashin(text, numeric, numeric, text, text) TO authenticated;
