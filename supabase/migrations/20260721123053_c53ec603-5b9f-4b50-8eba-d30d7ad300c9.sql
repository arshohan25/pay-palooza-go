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
    'service_role_select', has_table_privilege('service_role', 'public.platform_banks', 'SELECT'),
    'active_bank_count', (SELECT count(*)::int FROM public.platform_banks WHERE is_active = true)
  )
$$;