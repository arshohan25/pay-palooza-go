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
  v_exempt boolean;
  v_merchant_id uuid;
  v_cat merchant_category;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(kyc_exempt, false) INTO v_exempt FROM profiles WHERE user_id = v_user;
  SELECT (status = 'verified') INTO v_kyc_ok
    FROM kyc_verifications WHERE user_id = v_user
    ORDER BY created_at DESC LIMIT 1;

  IF NOT (COALESCE(v_kyc_ok, false) OR COALESCE(v_exempt, false)) THEN
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