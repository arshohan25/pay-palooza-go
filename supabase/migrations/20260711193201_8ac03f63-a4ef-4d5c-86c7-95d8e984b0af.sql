
CREATE OR REPLACE FUNCTION public.validate_wallet_id_format(
  _wallet_id text,
  _expected_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_role text;
  v_route text;
BEGIN
  IF _wallet_id IS NULL OR btrim(_wallet_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty');
  END IF;

  v_id := upper(btrim(_wallet_id));

  IF v_id ~ '^EZP-AGN[A-Z]{2}-[A-Z]{4}$' THEN
    v_role := 'agent';
    v_route := substring(v_id from 8 for 2);
  ELSIF v_id ~ '^EZP-MRC[A-Z]{2}-[A-Z]{4}$' THEN
    v_role := 'merchant';
    v_route := substring(v_id from 8 for 2);
  ELSIF v_id ~ '^EZP-[A-Z]{4}-[A-Z]{4}$'
        AND substring(v_id from 5 for 3) NOT IN ('AGN','MRC') THEN
    v_role := 'user';
    v_route := NULL;
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_format', 'normalized', v_id);
  END IF;

  IF _expected_role IS NOT NULL AND lower(_expected_role) <> v_role THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'role_mismatch',
      'role', v_role,
      'route', v_route,
      'normalized', v_id
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'role', v_role,
    'route', v_route,
    'normalized', v_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_wallet_id_format(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_wallet_id_format(text, text) TO authenticated, service_role;
