CREATE OR REPLACE FUNCTION public.check_platform_banks_grants()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'authenticated_select', has_table_privilege('authenticated', 'public.platform_banks', 'SELECT'),
    'anon_select', has_table_privilege('anon', 'public.platform_banks', 'SELECT'),
    'service_role_select', has_table_privilege('service_role', 'public.platform_banks', 'SELECT')
  )
$$;

GRANT EXECUTE ON FUNCTION public.check_platform_banks_grants() TO anon, authenticated, service_role;