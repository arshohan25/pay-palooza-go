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
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    IF r.proname = ANY(keep) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.sig);
    END IF;
  END LOOP;
END $$;

-- otp_tickets_used: RLS enabled with no policies -> make intent explicit
REVOKE ALL ON TABLE public.otp_tickets_used FROM anon, authenticated;
GRANT ALL ON TABLE public.otp_tickets_used TO service_role;

DROP POLICY IF EXISTS "otp_tickets_used_admin_select" ON public.otp_tickets_used;
CREATE POLICY "otp_tickets_used_admin_select"
  ON public.otp_tickets_used
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));