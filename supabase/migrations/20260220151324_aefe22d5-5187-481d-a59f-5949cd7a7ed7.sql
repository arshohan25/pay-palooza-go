
-- 1. Add "receive" to the txn_type enum
ALTER TYPE public.txn_type ADD VALUE IF NOT EXISTS 'receive';

-- 2. Create an atomic transfer function
--    Handles: peer-to-peer, agent-to-peer, peer-to-agent, peer-to-merchant, disbursement-to-peer
--    Looks up recipient by phone number, deducts from sender, credits recipient,
--    creates transaction records for BOTH parties.
CREATE OR REPLACE FUNCTION public.transfer_money(
  p_recipient_phone TEXT,
  p_amount NUMERIC,
  p_fee NUMERIC DEFAULT 0,
  p_type public.txn_type DEFAULT 'send',
  p_description TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_recipient_name TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID;
  v_sender_balance NUMERIC;
  v_recipient_profile RECORD;
  v_total_deduction NUMERIC;
  v_sender_new_balance NUMERIC;
  v_recipient_new_balance NUMERIC;
  v_sender_txn_id UUID;
  v_recipient_txn_id UUID;
BEGIN
  -- Get sender from auth context
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Calculate total deduction
  v_total_deduction := p_amount + p_fee;

  -- Lock and get sender balance
  SELECT balance INTO v_sender_balance
  FROM profiles
  WHERE user_id = v_sender_id
  FOR UPDATE;

  IF v_sender_balance IS NULL THEN
    RAISE EXCEPTION 'Sender profile not found';
  END IF;

  IF v_sender_balance < v_total_deduction THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Look up recipient by phone
  SELECT user_id, balance, name INTO v_recipient_profile
  FROM profiles
  WHERE phone = p_recipient_phone
  FOR UPDATE;

  -- Calculate new balances
  v_sender_new_balance := v_sender_balance - v_total_deduction;

  -- Deduct from sender
  UPDATE profiles
  SET balance = v_sender_new_balance
  WHERE user_id = v_sender_id;

  -- Generate transaction IDs
  v_sender_txn_id := gen_random_uuid();

  -- Insert sender's transaction record
  INSERT INTO transactions (id, user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
  VALUES (
    v_sender_txn_id,
    v_sender_id,
    p_type,
    p_amount,
    p_fee,
    v_sender_new_balance,
    p_recipient_phone,
    COALESCE(p_recipient_name, v_recipient_profile.name),
    p_description,
    p_reference,
    'completed'
  );

  -- If recipient exists in system, credit them
  IF v_recipient_profile.user_id IS NOT NULL THEN
    v_recipient_new_balance := v_recipient_profile.balance + p_amount;
    v_recipient_txn_id := gen_random_uuid();

    -- Credit recipient
    UPDATE profiles
    SET balance = v_recipient_new_balance
    WHERE user_id = v_recipient_profile.user_id;

    -- Insert recipient's transaction record
    INSERT INTO transactions (id, user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
    VALUES (
      v_recipient_txn_id,
      v_recipient_profile.user_id,
      'receive',
      p_amount,
      0,
      v_recipient_new_balance,
      (SELECT phone FROM profiles WHERE user_id = v_sender_id),
      (SELECT name FROM profiles WHERE user_id = v_sender_id),
      p_description,
      p_reference,
      'completed'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'sender_balance', v_sender_new_balance,
    'recipient_found', v_recipient_profile.user_id IS NOT NULL,
    'reference', p_reference
  );
END;
$$;
