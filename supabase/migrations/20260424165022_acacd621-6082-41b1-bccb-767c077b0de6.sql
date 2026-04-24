-- 1. Extend merchants
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS commission_rate numeric NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS business_kyc_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS business_kyc_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS business_kyc_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS business_kyc_rejection_reason text,
  ADD COLUMN IF NOT EXISTS nid_front_url text,
  ADD COLUMN IF NOT EXISTS nid_back_url text,
  ADD COLUMN IF NOT EXISTS trade_license_url text,
  ADD COLUMN IF NOT EXISTS bank_statement_url text;

-- 2. vendor_commission_overrides
CREATE TABLE IF NOT EXISTS public.vendor_commission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  category text NOT NULL,
  commission_rate numeric NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, category)
);
ALTER TABLE public.vendor_commission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors view own overrides"
  ON public.vendor_commission_overrides FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage overrides"
  ON public.vendor_commission_overrides FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. vendor_wallets
CREATE TABLE IF NOT EXISTS public.vendor_wallets (
  merchant_id uuid PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE,
  available_balance numeric NOT NULL DEFAULT 0,
  pending_balance numeric NOT NULL DEFAULT 0,
  lifetime_earnings numeric NOT NULL DEFAULT 0,
  lifetime_withdrawn numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendor_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors view own wallet"
  ON public.vendor_wallets FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins view all wallets"
  ON public.vendor_wallets FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. vendor_earnings_ledger
CREATE TABLE IF NOT EXISTS public.vendor_earnings_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  order_id uuid,
  gross_amount numeric NOT NULL,
  commission_rate numeric NOT NULL,
  commission_amount numeric NOT NULL,
  net_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vel_merchant ON public.vendor_earnings_ledger(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vel_order ON public.vendor_earnings_ledger(order_id);
ALTER TABLE public.vendor_earnings_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors view own earnings"
  ON public.vendor_earnings_ledger FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins view all earnings"
  ON public.vendor_earnings_ledger FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Extend merchant_payouts
ALTER TABLE public.merchant_payouts
  ADD COLUMN IF NOT EXISTS payout_method text NOT NULL DEFAULT 'easypay_wallet',
  ADD COLUMN IF NOT EXISTS destination_user_id uuid,
  ADD COLUMN IF NOT EXISTS credited_txn_id uuid;

-- 6. RPCs

-- get effective commission rate
CREATE OR REPLACE FUNCTION public.get_effective_commission_rate(p_merchant_id uuid, p_category text)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT commission_rate FROM vendor_commission_overrides
      WHERE merchant_id = p_merchant_id AND category = p_category LIMIT 1),
    (SELECT commission_rate FROM merchants WHERE id = p_merchant_id),
    5.00
  );
$$;

-- submit business KYC
CREATE OR REPLACE FUNCTION public.submit_business_kyc(
  p_business_name text,
  p_category text,
  p_trade_license text,
  p_trade_license_url text,
  p_nid_front_url text,
  p_nid_back_url text,
  p_bank_statement_url text,
  p_bank_name text,
  p_bank_account_number text,
  p_bank_account_holder text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_kyc_ok boolean;
  v_merchant_id uuid;
  v_cat merchant_category;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT (kyc_status = 'verified') INTO v_kyc_ok FROM profiles WHERE id = v_user;
  IF NOT COALESCE(v_kyc_ok, false) THEN
    RAISE EXCEPTION 'User KYC must be verified before applying as a vendor';
  END IF;

  IF EXISTS (SELECT 1 FROM merchants WHERE user_id = v_user) THEN
    RAISE EXCEPTION 'Vendor application already exists';
  END IF;

  BEGIN
    v_cat := p_category::merchant_category;
  EXCEPTION WHEN OTHERS THEN
    v_cat := 'other'::merchant_category;
  END;

  INSERT INTO merchants(
    user_id, business_name, category, trade_license, trade_license_url,
    nid_front_url, nid_back_url, bank_statement_url,
    bank_name, bank_account_number, bank_account_holder,
    status, business_kyc_status
  ) VALUES (
    v_user, p_business_name, v_cat, p_trade_license, p_trade_license_url,
    p_nid_front_url, p_nid_back_url, p_bank_statement_url,
    p_bank_name, p_bank_account_number, p_bank_account_holder,
    'pending', 'pending'
  ) RETURNING id INTO v_merchant_id;

  RETURN jsonb_build_object('success', true, 'merchant_id', v_merchant_id);
END;
$$;

-- approve business KYC
CREATE OR REPLACE FUNCTION public.approve_business_kyc(
  p_merchant_id uuid,
  p_commission_rate numeric DEFAULT 5.00
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE merchants
    SET business_kyc_status = 'approved',
        status = 'approved',
        commission_rate = p_commission_rate,
        business_kyc_reviewed_by = v_admin,
        business_kyc_reviewed_at = now(),
        business_kyc_rejection_reason = NULL
    WHERE id = p_merchant_id;

  INSERT INTO vendor_wallets(merchant_id) VALUES (p_merchant_id)
    ON CONFLICT (merchant_id) DO NOTHING;

  INSERT INTO vendor_stores(merchant_id, slug, store_name, is_active)
    SELECT id,
           lower(regexp_replace(business_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 6),
           business_name, true
    FROM merchants WHERE id = p_merchant_id
    ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- reject business KYC
CREATE OR REPLACE FUNCTION public.reject_business_kyc(
  p_merchant_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE merchants
    SET business_kyc_status = 'rejected',
        status = 'rejected',
        business_kyc_reviewed_by = v_admin,
        business_kyc_reviewed_at = now(),
        business_kyc_rejection_reason = p_reason
    WHERE id = p_merchant_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- credit vendor earnings (called when an order is paid)
CREATE OR REPLACE FUNCTION public.credit_vendor_earnings(
  p_merchant_id uuid,
  p_order_id uuid,
  p_gross_amount numeric,
  p_category text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rate numeric;
  v_commission numeric;
  v_net numeric;
BEGIN
  v_rate := public.get_effective_commission_rate(p_merchant_id, COALESCE(p_category, ''));
  v_commission := round(p_gross_amount * v_rate / 100.0, 2);
  v_net := p_gross_amount - v_commission;

  INSERT INTO vendor_earnings_ledger(merchant_id, order_id, gross_amount, commission_rate, commission_amount, net_amount, status)
    VALUES (p_merchant_id, p_order_id, p_gross_amount, v_rate, v_commission, v_net, 'pending');

  INSERT INTO vendor_wallets(merchant_id, pending_balance)
    VALUES (p_merchant_id, v_net)
    ON CONFLICT (merchant_id) DO UPDATE
      SET pending_balance = vendor_wallets.pending_balance + EXCLUDED.pending_balance,
          updated_at = now();

  RETURN jsonb_build_object('success', true, 'net', v_net, 'commission', v_commission);
END;
$$;

-- release vendor earnings (when order delivered)
CREATE OR REPLACE FUNCTION public.release_vendor_earnings(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, merchant_id, net_amount FROM vendor_earnings_ledger
      WHERE order_id = p_order_id AND status = 'pending'
  LOOP
    UPDATE vendor_earnings_ledger SET status = 'released', released_at = now() WHERE id = r.id;
    UPDATE vendor_wallets
      SET pending_balance = pending_balance - r.net_amount,
          available_balance = available_balance + r.net_amount,
          lifetime_earnings = lifetime_earnings + r.net_amount,
          updated_at = now()
      WHERE merchant_id = r.merchant_id;
  END LOOP;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- request payout (vendor)
CREATE OR REPLACE FUNCTION public.request_vendor_payout(p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_merchant record;
  v_balance numeric;
  v_payout_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  SELECT m.id, m.bank_name, m.bank_account_number, m.bank_account_holder
    INTO v_merchant FROM merchants m WHERE m.user_id = v_user AND m.business_kyc_status = 'approved';
  IF v_merchant.id IS NULL THEN RAISE EXCEPTION 'No approved vendor account'; END IF;

  SELECT available_balance INTO v_balance FROM vendor_wallets WHERE merchant_id = v_merchant.id FOR UPDATE;
  IF COALESCE(v_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Insufficient available balance';
  END IF;

  UPDATE vendor_wallets
    SET available_balance = available_balance - p_amount, updated_at = now()
    WHERE merchant_id = v_merchant.id;

  INSERT INTO merchant_payouts(merchant_id, amount, bank_name, account_number, account_holder, status, payout_method, destination_user_id)
    VALUES (v_merchant.id, p_amount, COALESCE(v_merchant.bank_name, 'EasyPay Wallet'),
            COALESCE(v_merchant.bank_account_number, ''), COALESCE(v_merchant.bank_account_holder, ''),
            'pending', 'easypay_wallet', v_user)
    RETURNING id INTO v_payout_id;

  RETURN jsonb_build_object('success', true, 'payout_id', v_payout_id);
END;
$$;

-- approve payout (admin) — credits user wallet
CREATE OR REPLACE FUNCTION public.approve_vendor_payout(p_payout_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_payout record;
  v_txn_id uuid;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO v_payout FROM merchant_payouts WHERE id = p_payout_id FOR UPDATE;
  IF v_payout.id IS NULL THEN RAISE EXCEPTION 'Payout not found'; END IF;
  IF v_payout.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  -- credit owner's user wallet
  UPDATE profiles SET balance = COALESCE(balance, 0) + v_payout.amount WHERE id = v_payout.destination_user_id;

  INSERT INTO transactions(user_id, type, amount, status, description, fee)
    VALUES (v_payout.destination_user_id, 'add_money', v_payout.amount, 'completed',
            'Vendor payout #' || substr(v_payout.id::text, 1, 8), 0)
    RETURNING id INTO v_txn_id;

  UPDATE merchant_payouts
    SET status = 'paid', admin_note = p_note, reviewed_by = v_admin,
        reviewed_at = now(), credited_txn_id = v_txn_id, updated_at = now()
    WHERE id = p_payout_id;

  UPDATE vendor_wallets
    SET lifetime_withdrawn = lifetime_withdrawn + v_payout.amount, updated_at = now()
    WHERE merchant_id = v_payout.merchant_id;

  RETURN jsonb_build_object('success', true, 'transaction_id', v_txn_id);
END;
$$;

-- reject payout (admin) — refunds available balance
CREATE OR REPLACE FUNCTION public.reject_vendor_payout(p_payout_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_payout record;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO v_payout FROM merchant_payouts WHERE id = p_payout_id FOR UPDATE;
  IF v_payout.id IS NULL THEN RAISE EXCEPTION 'Payout not found'; END IF;
  IF v_payout.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  UPDATE vendor_wallets
    SET available_balance = available_balance + v_payout.amount, updated_at = now()
    WHERE merchant_id = v_payout.merchant_id;

  UPDATE merchant_payouts
    SET status = 'rejected', admin_note = p_reason, reviewed_by = v_admin,
        reviewed_at = now(), updated_at = now()
    WHERE id = p_payout_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. Storage bucket for vendor KYC documents
INSERT INTO storage.buckets (id, name, public)
  VALUES ('vendor-kyc', 'vendor-kyc', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Vendors upload own kyc docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vendor-kyc' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Vendors view own kyc docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-kyc' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins view all kyc docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-kyc' AND public.has_role(auth.uid(), 'admin'));