
-- 1. Add referral_code column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- 2. Generate referral code function
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code TEXT;
  block1 TEXT;
  block2 TEXT;
  i INT;
BEGIN
  LOOP
    block1 := '';
    block2 := '';
    FOR i IN 1..4 LOOP
      block1 := block1 || substr(chars, floor(random() * 36 + 1)::int, 1);
      block2 := block2 || substr(chars, floor(random() * 36 + 1)::int, 1);
    END LOOP;
    code := 'EZP-' || block1 || '-' || block2;
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = code) THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- 3. Auto-generate referral code for new profiles
CREATE OR REPLACE FUNCTION public.auto_set_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_referral_code_on_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_referral_code();

-- Backfill existing profiles
UPDATE public.profiles SET referral_code = generate_referral_code() WHERE referral_code IS NULL;

-- 4. Create referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referee_id uuid NOT NULL UNIQUE, -- one referral per referee
  referral_code text NOT NULL,
  milestone_1_paid boolean NOT NULL DEFAULT false,
  milestone_2_paid boolean NOT NULL DEFAULT false,
  milestone_3_paid boolean NOT NULL DEFAULT false,
  total_rewarded numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_referral CHECK (referrer_id != referee_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals as referrer"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view own referral as referee"
ON public.referrals FOR SELECT
USING (auth.uid() = referee_id);

CREATE POLICY "Admins can manage all referrals"
ON public.referrals FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can insert referrals"
ON public.referrals FOR INSERT
WITH CHECK (auth.uid() = referee_id);

-- 5. Create referral_rewards table
CREATE TABLE public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals(id),
  referrer_id uuid NOT NULL,
  milestone text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rewards"
ON public.referral_rewards FOR SELECT
USING (auth.uid() = referrer_id);

CREATE POLICY "Admins can manage all rewards"
ON public.referral_rewards FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6. Create device_registrations table
CREATE TABLE public.device_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to device_registrations"
ON public.device_registrations FOR ALL
USING (false);

-- 7. check_referral_milestones RPC
CREATE OR REPLACE FUNCTION public.check_referral_milestones(p_referee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
  v_kyc_verified boolean;
  v_txn_count int;
  v_txn_total numeric;
BEGIN
  -- Get referral record with lock
  SELECT * INTO v_referral
  FROM referrals
  WHERE referee_id = p_referee_id
  FOR UPDATE;

  IF v_referral.id IS NULL THEN
    RETURN; -- No referral exists
  END IF;

  -- Milestone 1: KYC verified → ৳10
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
    END IF;
  END IF;

  -- Milestone 2: 1 txn ≥ ৳101 → ৳20
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
    END IF;
  END IF;

  -- Milestone 3: 5 txns ≥ ৳500 total → ৳20
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
    END IF;
  END IF;
END;
$$;

-- 8. Trigger on transactions INSERT to check milestones
CREATE OR REPLACE FUNCTION public.trigger_check_referral_on_txn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM check_referral_milestones(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_referral_after_txn
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_referral_on_txn();

-- 9. Trigger on kyc_verifications UPDATE to check milestone 1
CREATE OR REPLACE FUNCTION public.trigger_check_referral_on_kyc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'verified' AND (OLD.status IS DISTINCT FROM 'verified') THEN
    PERFORM check_referral_milestones(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_referral_after_kyc
AFTER UPDATE ON public.kyc_verifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_referral_on_kyc();

-- 10. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.referral_rewards;

-- 11. Updated_at trigger for referrals
CREATE TRIGGER update_referrals_updated_at
BEFORE UPDATE ON public.referrals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
