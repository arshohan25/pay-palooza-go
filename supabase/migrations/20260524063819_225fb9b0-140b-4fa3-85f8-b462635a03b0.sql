CREATE OR REPLACE FUNCTION repay_missed_dps(p_missed_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_missed dps_missed_payments;
  v_sched  savings_auto_save;
BEGIN
  -- Lock the missed-payment row
  SELECT * INTO v_missed
    FROM dps_missed_payments
    WHERE id = p_missed_id
      AND user_id = v_uid
      AND repaid = false
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Missed payment not found or already repaid';
  END IF;

  -- Lock the parent schedule
  SELECT * INTO v_sched
    FROM savings_auto_save
    WHERE id = v_missed.schedule_id
      AND user_id = v_uid
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule not found';
  END IF;

  -- Repay: deposit into linked goal or debit wallet directly
  IF v_sched.goal_id IS NOT NULL THEN
    PERFORM savings_deposit(v_sched.goal_id, v_missed.amount, 'dps_repay');
  ELSE
    UPDATE profiles
      SET balance    = balance - v_missed.amount,
          updated_at = now()
      WHERE user_id = v_uid
        AND balance >= v_missed.amount;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
  END IF;

  -- Mark missed payment repaid
  UPDATE dps_missed_payments
    SET repaid    = true,
        repaid_at = now()
    WHERE id = p_missed_id;

  -- Update schedule counters
  UPDATE savings_auto_save
    SET total_paid   = total_paid + 1,
        missed_count = GREATEST(0, missed_count - 1),
        updated_at   = now()
    WHERE id = v_missed.schedule_id;

  RETURN jsonb_build_object(
    'success', true,
    'amount',  v_missed.amount
  );
END;
$$;