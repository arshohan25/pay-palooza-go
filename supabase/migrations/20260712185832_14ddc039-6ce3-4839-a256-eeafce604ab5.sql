CREATE OR REPLACE FUNCTION public.generate_role_wallet_id_from_phone(
  p_phone text,
  p_role text DEFAULT 'user',
  p_route text DEFAULT 'DH'
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  seed1 text;
  seed2 text;
  h1 bigint := 0;
  h2 bigint := 0;
  h1_int int;
  h2_int int;
  block1 text := '';
  block2 text := '';
  i int;
  unsigned bigint;
  clean_route text;
BEGIN
  seed1 := COALESCE(p_phone, '');
  seed2 := seed1 || 'salt';

  FOR i IN 1..length(seed1) LOOP
    h1 := (h1 * 32) - h1 + ascii(substring(seed1 FROM i FOR 1));
    unsigned := h1 & x'FFFFFFFF'::bigint;
    IF unsigned >= 2147483648 THEN
      h1 := unsigned - 4294967296;
    ELSE
      h1 := unsigned;
    END IF;
  END LOOP;
  h1_int := h1::int;
  FOR i IN 0..3 LOOP
    block1 := block1 || substring(chars FROM (abs(h1_int >> (i * 5)) % 26) + 1 FOR 1);
  END LOOP;

  FOR i IN 1..length(seed2) LOOP
    h2 := (h2 * 32) - h2 + ascii(substring(seed2 FROM i FOR 1));
    unsigned := h2 & x'FFFFFFFF'::bigint;
    IF unsigned >= 2147483648 THEN
      h2 := unsigned - 4294967296;
    ELSE
      h2 := unsigned;
    END IF;
  END LOOP;
  h2_int := h2::int;
  FOR i IN 0..3 LOOP
    block2 := block2 || substring(chars FROM (abs(h2_int >> (i * 5)) % 26) + 1 FOR 1);
  END LOOP;

  clean_route := upper(regexp_replace(COALESCE(p_route, 'DH'), '[^A-Z]', '', 'g'));
  IF length(clean_route) < 2 THEN
    clean_route := 'DH';
  ELSE
    clean_route := substring(clean_route FROM 1 FOR 2);
  END IF;

  IF lower(COALESCE(p_role, 'user')) = 'agent' THEN
    RETURN 'EZP-AGN' || clean_route || '-' || block2;
  ELSIF lower(COALESCE(p_role, 'user')) = 'merchant' THEN
    RETURN 'EZP-MRC' || clean_route || '-' || block2;
  END IF;

  RETURN 'EZP-' || block1 || '-' || block2;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_role_wallet_id_from_phone(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_role_wallet_id_from_phone(text, text, text) TO service_role;

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

  IF p_flow = 'send' THEN
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

  ELSIF p_flow = 'cashout' THEN
    IF v_input ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      SELECT a.id, a.business_name, a.user_id, p.phone, p.name, a.territory_code
      INTO v_agent
      FROM agents a JOIN profiles p ON p.user_id = a.user_id
      WHERE a.id = v_input::uuid AND a.status = 'active' AND p.status = 'active'
      LIMIT 1;
      IF v_agent.user_id IS NOT NULL THEN
        RETURN json_build_object(
          'found', true,
          'recipient_phone', v_agent.phone,
          'recipient_name', COALESCE(v_agent.business_name, v_agent.name, v_agent.phone),
          'matched_by', 'agent_id',
          'recipient_wallet_id', public.generate_role_wallet_id_from_phone(v_agent.phone, 'agent', COALESCE(v_agent.territory_code, 'DH'))
        );
      END IF;
      RETURN json_build_object('found', false);
    END IF;

    IF v_input ~* '^EZP-AGN[A-Z]{2}-[A-Z]{4}$' THEN
      FOR v_agent IN
        SELECT a.id, a.business_name, a.user_id, p.phone, p.name, a.territory_code
        FROM agents a JOIN profiles p ON p.user_id = a.user_id
        WHERE a.status = 'active' AND p.status = 'active' AND a.user_id <> v_me
      LOOP
        v_wallet_id := public.generate_role_wallet_id_from_phone(v_agent.phone, 'agent', COALESCE(v_agent.territory_code, 'DH'));
        IF upper(v_wallet_id) = upper(v_input) THEN
          RETURN json_build_object(
            'found', true,
            'recipient_phone', v_agent.phone,
            'recipient_name', COALESCE(v_agent.business_name, v_agent.name, v_agent.phone),
            'matched_by', 'agent_wallet',
            'recipient_wallet_id', upper(v_input)
          );
        END IF;
      END LOOP;
      RETURN json_build_object('found', false);
    END IF;

    v_norm_phone := normalize_bd_phone(v_input);
    IF v_norm_phone ~ '^01[3-9][0-9]{8}$' THEN
      SELECT a.id, a.business_name, a.user_id, p.phone, p.name, a.territory_code
      INTO v_agent
      FROM agents a JOIN profiles p ON p.user_id = a.user_id
      WHERE p.phone = v_norm_phone AND a.status = 'active' AND p.status = 'active'
      LIMIT 1;
      IF v_agent.user_id IS NOT NULL THEN
        RETURN json_build_object(
          'found', true,
          'recipient_phone', v_agent.phone,
          'recipient_name', COALESCE(v_agent.business_name, v_agent.name, v_agent.phone),
          'matched_by', 'phone',
          'recipient_wallet_id', public.generate_role_wallet_id_from_phone(v_agent.phone, 'agent', COALESCE(v_agent.territory_code, 'DH'))
        );
      END IF;
    END IF;

    RETURN json_build_object('found', false);

  ELSIF p_flow = 'payment' THEN
    IF v_input ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
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

GRANT EXECUTE ON FUNCTION public.resolve_transfer_recipient(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_transfer_recipient(text, text) TO service_role;