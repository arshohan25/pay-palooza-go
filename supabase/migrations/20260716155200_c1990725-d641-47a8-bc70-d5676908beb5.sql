
-- 1. Restrict admin_role_permissions SELECT to admins only
DROP POLICY IF EXISTS "arp_read_authenticated" ON public.admin_role_permissions;
CREATE POLICY "arp_read_admin" ON public.admin_role_permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Restrict role_redirect_logs INSERT to service_role only
DROP POLICY IF EXISTS "Anyone can log a redirect attempt" ON public.role_redirect_logs;
CREATE POLICY "Service role can log redirect attempts" ON public.role_redirect_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 3. Fix mutable search_path on trigger function
CREATE OR REPLACE FUNCTION public.trg_validate_location_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  _div text := to_jsonb(NEW)->>'division';
  _dist text := COALESCE(to_jsonb(NEW)->>'district_name', to_jsonb(NEW)->>'district');
  _up text := to_jsonb(NEW)->>'upazila';
  _un text := to_jsonb(NEW)->>'union_parishad';
  _ty text := to_jsonb(NEW)->>'area_type';
BEGIN
  IF NOT public.validate_location_hierarchy(_div,_dist,_up,_un,_ty) THEN
    RAISE EXCEPTION 'Invalid location hierarchy: %/%/%/% (%)', _div,_dist,_up,_un,_ty
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $function$;
