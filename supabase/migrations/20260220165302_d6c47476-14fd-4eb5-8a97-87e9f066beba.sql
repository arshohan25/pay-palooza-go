
CREATE OR REPLACE FUNCTION public.transfer_money(
  p_recipient_phone text,
  p_amount numeric,
  p_fee numeric DEFAULT 0,
  p_type txn_type DEFAULT 'send'::txn_type,
  p_description text DEFAULT NULL::text,
  p_reference text DEFAULT NULL::text,
  p_recipient_name text DEFAULT NULL::text,
  p_recipient_type txn_type DEFAULT 'receive'::txn_type
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_total_deduction := p_amount + p_fee;

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

  SELECT user_id, balance, name INTO v_recipient_profile
  FROM profiles
  WHERE phone = p_recipient_phone
  FOR UPDATE;

  v_sender_new_balance := v_sender_balance - v_total_deduction;

  UPDATE profiles
  SET balance = v_sender_new_balance
  WHERE user_id = v_sender_id;

  v_sender_txn_id := gen_random_uuid();

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

  IF v_recipient_profile.user_id IS NOT NULL THEN
    v_recipient_new_balance := v_recipient_profile.balance + p_amount;
    v_recipient_txn_id := gen_random_uuid();

    UPDATE profiles
    SET balance = v_recipient_new_balance
    WHERE user_id = v_recipient_profile.user_id;

    INSERT INTO transactions (id, user_id, type, amount, fee, balance_after, recipient_phone, recipient_name, description, reference, status)
    VALUES (
      v_recipient_txn_id,
      v_recipient_profile.user_id,
      p_recipient_type,
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
$function$;
