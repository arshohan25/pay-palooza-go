
DROP FUNCTION public.get_staff_merchant_access(uuid);

CREATE OR REPLACE FUNCTION public.get_staff_merchant_access(p_user_id uuid)
RETURNS TABLE(staff_id uuid, merchant_id uuid, business_name text, staff_role text, permissions jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ms.id, ms.merchant_id, m.business_name, ms.role, ms.permissions
  FROM public.merchant_staff ms
  JOIN public.merchants m ON m.id = ms.merchant_id
  WHERE ms.user_id = p_user_id
    AND ms.is_active = true
    AND m.status = 'active'
  LIMIT 1;
$function$;
