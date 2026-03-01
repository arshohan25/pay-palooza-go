
-- RPC: Toggle a single referral milestone (pay or reset)
CREATE OR REPLACE FUNCTION public.admin_toggle_referral_milestone(
  p_referral_id uuid,
  p_milestone int,
  p_action text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid;
  v_referral RECORD;
  v_amount numeric;
  v_milestone_col text;
  v_milestone_key text;
  v_is_paid boolean;
  v_deduction numeric;
  v_new_status text;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_milestone NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'Invalid milestone: must be 1, 2, or 3';
  END IF;
  IF p_action NOT IN ('pay', 'reset') THEN
    RAISE EXCEPTION 'Invalid action: must be pay or reset';
  END IF;

  -- Determine amount and column
  IF p_milestone = 1 THEN v_amount := 10; v_milestone_col := 'milestone_1_paid'; v_milestone_key := 'kyc_verified';
  ELSIF p_milestone = 2 THEN v_amount := 20; v_milestone_col := 'milestone_2_paid'; v_milestone_key := 'first_txn';
  ELSE v_amount := 20; v_milestone_col := 'milestone_3_paid'; v_milestone_key := 'five_txns';
  END IF;

  -- Lock referral row
  SELECT * INTO v_referral FROM referrals WHERE id = p_referral_id FOR UPDATE;
  IF v_referral.id IS NULL THEN
    RAISE EXCEPTION 'Referral not found';
  END IF;

  -- Check current state
  IF p_milestone = 1 THEN v_is_paid := v_referral.milestone_1_paid;
  ELSIF p_milestone = 2 THEN v_is_paid := v_referral.milestone_2_paid;
  ELSE v_is_paid := v_referral.milestone_3_paid;
  END IF;

  IF p_action = 'pay' THEN
    IF v_is_paid THEN
      RAISE EXCEPTION 'Milestone already paid';
    END IF;

    -- Credit referrer balance (lock profile row)
    UPDATE profiles SET balance = balance + v_amount
    WHERE user_id = v_referral.referrer_id;

    -- Insert reward audit row
    INSERT INTO referral_rewards (referral_id, referrer_id, milestone, amount)
    VALUES (p_referral_id, v_referral.referrer_id, v_milestone_key, v_amount);

    -- Update referral flags
    IF p_milestone = 1 THEN
      UPDATE referrals SET milestone_1_paid = true, total_rewarded = total_rewarded + v_amount, status = 'active', updated_at = now() WHERE id = p_referral_id;
    ELSIF p_milestone = 2 THEN
      UPDATE referrals SET milestone_2_paid = true, total_rewarded = total_rewarded + v_amount, updated_at = now() WHERE id = p_referral_id;
    ELSE
      UPDATE referrals SET milestone_3_paid = true, total_rewarded = total_rewarded + v_amount, status = 'completed', updated_at = now() WHERE id = p_referral_id;
    END IF;

  ELSIF p_action = 'reset' THEN
    IF NOT v_is_paid THEN
      RAISE EXCEPTION 'Milestone not yet paid';
    END IF;

    -- Deduct from referrer balance (capped at available)
    UPDATE profiles SET balance = GREATEST(balance - v_amount, 0)
    WHERE user_id = v_referral.referrer_id;

    -- Delete corresponding reward row
    DELETE FROM referral_rewards
    WHERE referral_id = p_referral_id AND milestone = v_milestone_key;

    -- Recalculate status
    IF p_milestone = 1 THEN
      UPDATE referrals SET milestone_1_paid = false, total_rewarded = GREATEST(total_rewarded - v_amount, 0), updated_at = now() WHERE id = p_referral_id;
    ELSIF p_milestone = 2 THEN
      UPDATE referrals SET milestone_2_paid = false, total_rewarded = GREATEST(total_rewarded - v_amount, 0), updated_at = now() WHERE id = p_referral_id;
    ELSE
      UPDATE referrals SET milestone_3_paid = false, total_rewarded = GREATEST(total_rewarded - v_amount, 0), updated_at = now() WHERE id = p_referral_id;
    END IF;

    -- Recalculate status based on remaining milestones
    SELECT * INTO v_referral FROM referrals WHERE id = p_referral_id;
    IF NOT v_referral.milestone_1_paid AND NOT v_referral.milestone_2_paid AND NOT v_referral.milestone_3_paid THEN
      v_new_status := 'pending';
    ELSIF v_referral.milestone_1_paid AND v_referral.milestone_2_paid AND v_referral.milestone_3_paid THEN
      v_new_status := 'completed';
    ELSE
      v_new_status := 'active';
    END IF;
    UPDATE referrals SET status = v_new_status WHERE id = p_referral_id;
  END IF;

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'referral_milestone_' || p_action, 'referral', p_referral_id,
    jsonb_build_object('milestone', p_milestone, 'milestone_key', v_milestone_key, 'amount', v_amount, 'action', p_action));

  RETURN json_build_object('success', true, 'milestone', p_milestone, 'action', p_action);
END;
$$;

-- RPC: Reset all milestones for a referral
CREATE OR REPLACE FUNCTION public.admin_reset_all_milestones(p_referral_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid;
  v_referral RECORD;
  v_deduction numeric;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT has_role(v_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT * INTO v_referral FROM referrals WHERE id = p_referral_id FOR UPDATE;
  IF v_referral.id IS NULL THEN
    RAISE EXCEPTION 'Referral not found';
  END IF;

  IF v_referral.total_rewarded = 0 AND NOT v_referral.milestone_1_paid AND NOT v_referral.milestone_2_paid AND NOT v_referral.milestone_3_paid THEN
    RAISE EXCEPTION 'No milestones to reset';
  END IF;

  v_deduction := v_referral.total_rewarded;

  -- Deduct from referrer balance (capped)
  IF v_deduction > 0 THEN
    UPDATE profiles SET balance = GREATEST(balance - v_deduction, 0)
    WHERE user_id = v_referral.referrer_id;
  END IF;

  -- Delete all reward rows
  DELETE FROM referral_rewards WHERE referral_id = p_referral_id;

  -- Reset all flags
  UPDATE referrals
  SET milestone_1_paid = false, milestone_2_paid = false, milestone_3_paid = false,
      total_rewarded = 0, status = 'pending', updated_at = now()
  WHERE id = p_referral_id;

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, 'referral_reset_all', 'referral', p_referral_id,
    jsonb_build_object('previous_total_rewarded', v_deduction, 'referrer_id', v_referral.referrer_id));

  RETURN json_build_object('success', true, 'deducted', v_deduction);
END;
$$;
