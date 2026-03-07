
-- Helper: normalize BD phone to 11-digit local form
CREATE OR REPLACE FUNCTION public.normalize_bd_phone(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  v := regexp_replace(COALESCE(p_raw, ''), '[^0-9]', '', 'g');
  -- Strip leading 88 country code
  IF left(v, 2) = '88' AND length(v) > 11 THEN
    v := substring(v FROM 3);
  END IF;
  RETURN v;
END;
$$;

-- Helper: deterministic wallet ID from phone (mirrors JS generateWalletId)
CREATE OR REPLACE FUNCTION public.generate_wallet_id_from_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  seed1 text;
  seed2 text;
  h1 int := 0;
  h2 int := 0;
  block1 text := '';
  block2 text := '';
  i int;
BEGIN
  seed1 := p_phone;
  seed2 := p_phone || 'salt';
  
  -- hash block 1
  FOR i IN 1..length(seed1) LOOP
    h1 := ((h1 * 31) + ascii(substring(seed1 FROM i FOR 1)));
    -- Keep within 32-bit int range using bitwise AND
    h1 := h1 & x'7FFFFFFF'::int;
  END LOOP;
  FOR i IN 0..3 LOOP
    block1 := block1 || substring(chars FROM (abs(h1 >> (i * 5)) % 26) + 1 FOR 1);
  END LOOP;
  
  -- hash block 2
  FOR i IN 1..length(seed2) LOOP
    h2 := ((h2 * 31) + ascii(substring(seed2 FROM i FOR 1)));
    h2 := h2 & x'7FFFFFFF'::int;
  END LOOP;
  FOR i IN 0..3 LOOP
    block2 := block2 || substring(chars FROM (abs(h2 >> (i * 5)) % 26) + 1 FOR 1);
  END LOOP;
  
  RETURN 'EZP-' || block1 || '-' || block2;
END;
$$;

-- Main resolver RPC
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
      -- Search all active profiles for matching wallet ID
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
            'matched_by', 'wallet'
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
          'matched_by', 'phone'
        );
      END IF;
    END IF;

    RETURN json_build_object('found', false);

  -- ════════════════════════════════════════════════
  -- CASHOUT FLOW: agent phone or agent UUID
  -- ════════════════════════════════════════════════
  ELSIF p_flow = 'cashout' THEN
    -- Try as UUID (agents.id)
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

    -- Try as phone
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
    -- Try as UUID (merchants.id)
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

    -- Try as merchant QR code data (e.g. MRC-...)
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
          'matched_by', 'merchant_code'
        );
      END IF;
      RETURN json_build_object('found', false);
    END IF;

    -- Try as phone
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
  ELSE
    RAISE EXCEPTION 'Invalid flow: %', p_flow;
  END IF;
END;
$$;
