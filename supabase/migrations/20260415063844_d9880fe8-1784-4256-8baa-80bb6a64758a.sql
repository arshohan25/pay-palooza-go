
CREATE OR REPLACE FUNCTION public.resolve_transfer_recipient(p_identifier text, p_flow text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_input text;
  v_norm_phone text;
  v_profile RECORD;
  v_agent RECORD;
  v_merchant RECORD;
  v_wallet_id text;
BEGIN
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_input := trim(COALESCE(p_identifier, ''));
  IF v_input = '' THEN
    RETURN json_build_object('found', false);
  END IF;

  -- ════════════════════════════════════════════════
  -- SEND FLOW: phone or EZP wallet ID
  -- ════════════════════════════════════════════════
  IF p_flow = 'send' THEN
    -- Try as wallet ID first
    IF v_input ~* '^EZP-[A-Z]{4}-[A-Z]{4}$' THEN
      FOR v_profile IN
        SELECT user_id, name, phone
        FROM profiles
        WHERE status = 'active' AND user_id <> v_me
      LOOP
        v_wallet_id := generate_wallet_id_from_phone(v_profile.phone);
        IF upper(v_wallet_id) = upper(v_input) THEN
          RETURN json_build_object(
            'found', true,
            'recipient_phone', v_profile.phone,
            'recipient_name', COALESCE(v_profile.name, v_profile.phone),
            'matched_by', 'wallet',
            'recipient_wallet_id', upper(v_input)
          );
        END IF;
      END LOOP;
      RETURN json_build_object('found', false);
    END IF;

    -- Try as phone
    v_norm_phone := normalize_bd_phone(v_input);
    IF v_norm_phone ~ '^01[3-9][0-9]{8}$' THEN
      SELECT user_id, name, phone INTO v_profile
      FROM profiles
      WHERE phone = v_norm_phone AND status = 'active' AND user_id <> v_me
      LIMIT 1;
      IF v_profile.user_id IS NOT NULL THEN
        RETURN json_build_object(
          'found', true,
          'recipient_phone', v_profile.phone,
          'recipient_name', COALESCE(v_profile.name, v_profile.phone),
          'matched_by', 'phone',
          'recipient_wallet_id', generate_wallet_id_from_phone(v_profile.phone)
        );
      END IF;
    END IF;

    RETURN json_build_object('found', false);

  -- ════════════════════════════════════════════════
  -- CASHOUT FLOW: agent phone or agent UUID
  -- ════════════════════════════════════════════════
  ELSIF p_flow = 'cashout' THEN
    IF v_input ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      SELECT a.id, a.business_name, a.user_id, p.phone, p.name
      INTO v_agent
      FROM agents a JOIN profiles p ON p.user_id = a.user_id
      WHERE a.id = v_input::uuid AND a.status = 'active' AND p.status = 'active'
      LIMIT 1;
      IF v_agent.user_id IS NOT NULL THEN
        RETURN json_build_object(
          'found', true,
          'recipient_phone', v_agent.phone,
          'recipient_name', COALESCE(v_agent.business_name, v_agent.name, v_agent.phone),
          'matched_by', 'agent_id'
        );
      END IF;
      RETURN json_build_object('found', false);
    END IF;

    v_norm_phone := normalize_bd_phone(v_input);
    IF v_norm_phone ~ '^01[3-9][0-9]{8}$' THEN
      SELECT a.id, a.business_name, a.user_id, p.phone, p.name
      INTO v_agent
      FROM agents a JOIN profiles p ON p.user_id = a.user_id
      WHERE p.phone = v_norm_phone AND a.status = 'active' AND p.status = 'active'
      LIMIT 1;
      IF v_agent.user_id IS NOT NULL THEN
        RETURN json_build_object(
          'found', true,
          'recipient_phone', v_agent.phone,
          'recipient_name', COALESCE(v_agent.business_name, v_agent.name, v_agent.phone),
          'matched_by', 'phone'
        );
      END IF;
    END IF;

    RETURN json_build_object('found', false);

  -- ════════════════════════════════════════════════
  -- PAYMENT FLOW: merchant phone, UUID, or QR code
  -- ════════════════════════════════════════════════
  ELSIF p_flow = 'payment' THEN
    IF v_input ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      SELECT m.id, m.business_name, m.user_id, p.phone, p.name
      INTO v_merchant
      FROM merchants m JOIN profiles p ON p.user_id = m.user_id
      WHERE m.id = v_input::uuid AND m.status = 'active' AND p.status = 'active'
      LIMIT 1;
      IF v_merchant.user_id IS NOT NULL THEN
        RETURN json_build_object(
          'found', true,
          'recipient_phone', v_merchant.phone,
          'recipient_name', COALESCE(v_merchant.business_name, v_merchant.name, v_merchant.phone),
          'matched_by', 'merchant_id'
        );
      END IF;
      RETURN json_build_object('found', false);
    END IF;

    IF v_input ~* '^MRC-' THEN
      SELECT m.id, m.business_name, m.user_id, p.phone, p.name
      INTO v_merchant
      FROM merchants m JOIN profiles p ON p.user_id = m.user_id
      WHERE m.qr_code_data = v_input AND m.status = 'active' AND p.status = 'active'
      LIMIT 1;
      IF v_merchant.user_id IS NOT NULL THEN
        RETURN json_build_object(
          'found', true,
          'recipient_phone', v_merchant.phone,
          'recipient_name', COALESCE(v_merchant.business_name, v_merchant.name, v_merchant.phone),
          'matched_by', 'merchant_qr'
        );
      END IF;
      RETURN json_build_object('found', false);
    END IF;

    v_norm_phone := normalize_bd_phone(v_input);
    IF v_norm_phone ~ '^01[3-9][0-9]{8}$' THEN
      SELECT m.id, m.business_name, m.user_id, p.phone, p.name
      INTO v_merchant
      FROM merchants m JOIN profiles p ON p.user_id = m.user_id
      WHERE p.phone = v_norm_phone AND m.status = 'active' AND p.status = 'active'
      LIMIT 1;
      IF v_merchant.user_id IS NOT NULL THEN
        RETURN json_build_object(
          'found', true,
          'recipient_phone', v_merchant.phone,
          'recipient_name', COALESCE(v_merchant.business_name, v_merchant.name, v_merchant.phone),
          'matched_by', 'phone'
        );
      END IF;
    END IF;

    RETURN json_build_object('found', false);
  END IF;

  RETURN json_build_object('found', false);
END;
$$;
