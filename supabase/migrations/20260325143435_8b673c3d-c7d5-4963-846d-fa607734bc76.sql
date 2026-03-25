CREATE OR REPLACE FUNCTION public.check_referral_milestones(p_referee_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referral RECORD;
  v_kyc_verified boolean;
  v_txn_count int;
  v_txn_total numeric;
  v_referee_name text;
BEGIN
  SELECT * INTO v_referral
  FROM referrals
  WHERE referee_id = p_referee_id
  FOR UPDATE;

  IF v_referral.id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(name, phone, 'A friend') INTO v_referee_name
  FROM profiles WHERE user_id = p_referee_id;

  IF NOT v_referral.milestone_1_paid THEN
    SELECT EXISTS(
      SELECT 1 FROM kyc_verifications
      WHERE user_id = p_referee_id AND status = 'verified'
    ) INTO v_kyc_verified;

    IF v_kyc_verified THEN
      UPDATE profiles SET balance = balance + 10 WHERE user_id = v_referral.referrer_id;
      INSERT INTO referral_rewards (referral_id, referrer_id, milestone, amount)
      VALUES (v_referral.id, v_referral.referrer_id, 'kyc_verified', 10);
      UPDATE referrals SET milestone_1_paid = true, total_rewarded = total_rewarded + 10, status = 'active', updated_at = now()
      WHERE id = v_referral.id;

      INSERT INTO notifications (user_id, title, body, category, metadata)
      VALUES (v_referral.referrer_id, '🎉 Referral Reward: ৳10',
        v_referee_name || ' completed KYC verification! ৳10 added to your wallet.',
        'referral',
        jsonb_build_object('referral_id', v_referral.id, 'milestone', 'kyc_verified', 'amount', 10));
    END IF;
  END IF;

  IF NOT v_referral.milestone_2_paid THEN
    SELECT COUNT(*) INTO v_txn_count
    FROM transactions
    WHERE user_id = p_referee_id AND status = 'completed' AND amount >= 101;

    IF v_txn_count >= 1 THEN
      UPDATE profiles SET balance = balance + 20 WHERE user_id = v_referral.referrer_id;
      INSERT INTO referral_rewards (referral_id, referrer_id, milestone, amount)
      VALUES (v_referral.id, v_referral.referrer_id, 'first_txn', 20);
      UPDATE referrals SET milestone_2_paid = true, total_rewarded = total_rewarded + 20, updated_at = now()
      WHERE id = v_referral.id;

      INSERT INTO notifications (user_id, title, body, category, metadata)
      VALUES (v_referral.referrer_id, '🎉 Referral Reward: ৳20',
        v_referee_name || ' made their first transaction! ৳20 added to your wallet.',
        'referral',
        jsonb_build_object('referral_id', v_referral.id, 'milestone', 'first_txn', 'amount', 20));
    END IF;
  END IF;

  IF NOT v_referral.milestone_3_paid THEN
    SELECT COUNT(*), COALESCE(SUM(amount), 0)
    INTO v_txn_count, v_txn_total
    FROM transactions
    WHERE user_id = p_referee_id AND status = 'completed';

    IF v_txn_count >= 5 AND v_txn_total >= 500 THEN
      UPDATE profiles SET balance = balance + 20 WHERE user_id = v_referral.referrer_id;
      INSERT INTO referral_rewards (referral_id, referrer_id, milestone, amount)
      VALUES (v_referral.id, v_referral.referrer_id, 'five_txns', 20);
      UPDATE referrals SET milestone_3_paid = true, total_rewarded = total_rewarded + 20, status = 'completed', updated_at = now()
      WHERE id = v_referral.id;

      INSERT INTO notifications (user_id, title, body, category, metadata)
      VALUES (v_referral.referrer_id, '🎉 Referral Reward: ৳20',
        v_referee_name || ' completed 5 transactions! ৳20 added to your wallet.',
        'referral',
        jsonb_build_object('referral_id', v_referral.id, 'milestone', 'five_txns', 'amount', 20));
    END IF;
  END IF;
END;
$function$;