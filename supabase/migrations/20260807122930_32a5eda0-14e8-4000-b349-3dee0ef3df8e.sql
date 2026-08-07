DO $$
DECLARE
  r record;
  keep text[] := ARRAY[
    'is_phone_registered',
    'get_shop_products',
    'get_merchant_display_name',
    'get_nearby_agents',
    'nearby_agents',
    'get_public_session_info',
    'resolve_payment_merchant',
    'validate_location_hierarchy'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_ok
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    IF r.auth_ok THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    IF r.proname = ANY(keep) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.sig);
    END IF;
  END LOOP;
END $$;