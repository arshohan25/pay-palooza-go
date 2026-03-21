
-- Public merchant resolver for guest checkout (no auth.uid() required)
CREATE OR REPLACE FUNCTION public.resolve_payment_merchant(p_identifier text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_norm text;
  v_merchant RECORD;
  v_profile RECORD;
BEGIN
  IF p_identifier IS NULL OR LENGTH(TRIM(p_identifier)) < 2 THEN
    RETURN json_build_object('found', false, 'error', 'Invalid identifier');
  END IF;

  -- Try merchant QR code first (e.g. MRC-RAFIQ-001)
  SELECT m.id, m.business_name, m.category, m.user_id, m.qr_code
  INTO v_merchant
  FROM merchants m
  WHERE m.status = 'active'
    AND m.qr_code = UPPER(TRIM(p_identifier));

  IF v_merchant.id IS NOT NULL THEN
    SELECT phone, name INTO v_profile
    FROM profiles
    WHERE user_id = v_merchant.user_id AND status = 'active';

    IF v_profile.phone IS NOT NULL THEN
      RETURN json_build_object(
        'found', true,
        'recipient_phone', v_profile.phone,
        'recipient_name', v_merchant.business_name,
        'merchant_id', v_merchant.id,
        'category', COALESCE(v_merchant.category, '')
      );
    END IF;
  END IF;

  -- Try wallet ID (EZP-XXXX-XXXX)
  IF UPPER(p_identifier) ~ '^EZP-[A-Z]{4}-[A-Z]{4}$' THEN
    SELECT user_id, phone, name INTO v_profile
    FROM profiles
    WHERE wallet_id = UPPER(TRIM(p_identifier)) AND status = 'active';

    IF v_profile.user_id IS NOT NULL THEN
      SELECT m.id, m.business_name, m.category
      INTO v_merchant
      FROM merchants m
      WHERE m.user_id = v_profile.user_id AND m.status = 'active';

      RETURN json_build_object(
        'found', true,
        'recipient_phone', v_profile.phone,
        'recipient_name', COALESCE(v_merchant.business_name, v_profile.name, v_profile.phone),
        'merchant_id', v_merchant.id,
        'category', COALESCE(v_merchant.category, '')
      );
    END IF;
  END IF;

  -- Try phone number
  v_norm := regexp_replace(COALESCE(p_identifier, ''), '[^0-9]', '', 'g');
  IF left(v_norm, 2) = '88' AND length(v_norm) > 11 THEN
    v_norm := substring(v_norm FROM 3);
  END IF;

  IF v_norm ~ '^01[3-9][0-9]{8}$' THEN
    SELECT user_id, phone, name INTO v_profile
    FROM profiles
    WHERE phone = v_norm AND status = 'active';

    IF v_profile.user_id IS NOT NULL THEN
      SELECT m.id, m.business_name, m.category
      INTO v_merchant
      FROM merchants m
      WHERE m.user_id = v_profile.user_id AND m.status = 'active';

      IF v_merchant.id IS NOT NULL THEN
        RETURN json_build_object(
          'found', true,
          'recipient_phone', v_profile.phone,
          'recipient_name', COALESCE(v_merchant.business_name, v_profile.name),
          'merchant_id', v_merchant.id,
          'category', COALESCE(v_merchant.category, '')
        );
      END IF;
    END IF;
  END IF;

  RETURN json_build_object('found', false, 'error', 'Merchant not found');
END;
$$;
