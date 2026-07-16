
CREATE OR REPLACE FUNCTION public.agent_b2b_transfer(
  p_recipient_phone text,
  p_amount numeric,
  p_fee numeric DEFAULT 0,
  p_recipient_kind text DEFAULT 'agent',
  p_description text DEFAULT NULL,
  p_reference text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid;
  v_sender_balance numeric;
  v_sender_new_balance numeric;
  v_recipient RECORD;
  v_credited numeric;
  v_recipient_new_balance numeric;
  v_sender_txn uuid;
  v_recipient_txn uuid;
  v_treasury RECORD;
  v_new_treasury_balance numeric;
  v_recipient_is_agent boolean;
  v_recipient_is_distributor boolean;
BEGIN
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM require_kyc_verified(v_sender_id);

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_fee IS NULL OR p_fee < 0 THEN RAISE EXCEPTION 'Fee cannot be negative'; END IF;
  IF p_fee >= p_amount THEN RAISE EXCEPTION 'Fee must be less than amount'; END IF;
  IF p_recipient_kind NOT IN ('agent','distributor') THEN RAISE EXCEPTION 'Invalid recipient kind'; END IF;

  SELECT balance INTO v_sender_balance FROM profiles WHERE user_id = v_sender_id FOR UPDATE;
  IF v_sender_balance IS NULL THEN RAISE EXCEPTION 'Sender profile not found'; END IF;
  IF v_sender_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  SELECT user_id, balance, name INTO v_recipient FROM profiles WHERE phone = p_recipient_phone FOR UPDATE;
  IF v_recipient.user_id IS NULL THEN RAISE EXCEPTION 'Recipient not found'; END IF;
  IF v_recipient.user_id = v_sender_id THEN RAISE EXCEPTION 'Cannot transfer to yourself'; END IF;

  SELECT
    EXISTS(SELECT 1 FROM user_roles WHERE user_id = v_recipient.user_id AND role::text = 'agent'),
    EXISTS(SELECT 1 FROM user_roles WHERE user_id = v_recipient.user_id AND role::text IN ('distributor','super_distributor'))
  INTO v_recipient_is_agent, v_recipient_is_distributor;

  IF p_recipient_kind = 'agent' AND NOT v_recipient_is_agent THEN
    RAISE EXCEPTION 'Recipient is not an agent';
  END IF;
  IF p_recipient_kind = 'distributor' AND NOT v_recipient_is_distributor THEN
    RAISE EXCEPTION 'Recipient is not a distributor';
  END IF;

  v_credited := p_amount - p_fee;
  v_sender_new_balance := v_sender_balance - p_amount;
  v_recipient_new_balance := v_recipient.balance + v_credited;

  UPDATE profiles SET balance = v_sender_new_balance WHERE user_id = v_sender_id;
  UPDATE profiles SET balance = v_recipient_new_balance WHERE user_id = v_recipient.user_id;

  v_sender_txn := gen_random_uuid();
  v_recipient_txn := gen_random_uuid();

  INSERT INTO transactions (id, user_id, type, amount, fee, commission, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_sender_txn, v_sender_id, 'send'::txn_type, p_amount, 0, 0, v_sender_new_balance,
    p_recipient_phone, v_recipient.name, COALESCE(p_description, 'B2B Transfer'), p_reference, 'completed');

  INSERT INTO transactions (id, user_id, type, amount, fee, commission, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (v_recipient_txn, v_recipient.user_id, 'receive'::txn_type, p_amount, p_fee, 0, v_recipient_new_balance,
    (SELECT phone FROM profiles WHERE user_id = v_sender_id),
    (SELECT name FROM profiles WHERE user_id = v_sender_id),
    COALESCE(p_description, 'B2B Transfer'), p_reference, 'completed');

  IF p_fee > 0 THEN
    SELECT * INTO v_treasury FROM platform_treasury LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NOT NULL THEN
      v_new_treasury_balance := v_treasury.balance + p_fee;
      UPDATE platform_treasury SET balance = v_new_treasury_balance, total_earnings = total_earnings + p_fee, updated_at = now() WHERE id = v_treasury.id;
      INSERT INTO treasury_ledger (type, amount, balance_after, counterparty_user_id, description, reference)
      VALUES ('earning', p_fee, v_new_treasury_balance, v_recipient.user_id, 'B2B receiver fee', p_reference);
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'sender_balance', v_sender_new_balance, 'reference', p_reference);
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_b2b_transfer(text, numeric, numeric, text, text, text) TO authenticated;
