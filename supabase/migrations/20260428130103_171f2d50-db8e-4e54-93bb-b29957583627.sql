-- 1. Add permissions column
ALTER TABLE public.merchant_staff
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Backfill from role
UPDATE public.merchant_staff
SET permissions = CASE role
  WHEN 'Manager' THEN jsonb_build_object(
    'orders_view', true, 'orders_manage', true,
    'refunds_view', true, 'refunds_manage', true,
    'inbox', true,
    'products_view', true, 'products_manage', true,
    'coupons', true,
    'transactions', true, 'payouts', true, 'settlements', true, 'mdr', true,
    'customers_view', true, 'analytics', true, 'paylinks', true,
    'qr', true, 'store_settings', true,
    'notifications', true
  )
  WHEN 'Cashier' THEN jsonb_build_object(
    'orders_view', true, 'orders_manage', true,
    'products_view', true,
    'inbox', true,
    'customers_view', true,
    'qr', true,
    'notifications', true
  )
  ELSE jsonb_build_object(
    'orders_view', true,
    'products_view', true,
    'transactions', true,
    'analytics', true,
    'notifications', true
  )
END
WHERE permissions = '{}'::jsonb;

-- 3. Validation trigger
CREATE OR REPLACE FUNCTION public.validate_merchant_staff_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.permissions IS NULL THEN
    NEW.permissions := '{}'::jsonb;
  END IF;
  NEW.permissions := NEW.permissions - 'staff_manage' - 'api_access';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_merchant_staff_permissions ON public.merchant_staff;
CREATE TRIGGER trg_validate_merchant_staff_permissions
BEFORE INSERT OR UPDATE OF permissions ON public.merchant_staff
FOR EACH ROW EXECUTE FUNCTION public.validate_merchant_staff_permissions();

-- 4. Recreate RPC with permissions column
DROP FUNCTION IF EXISTS public.get_staff_merchant_access(uuid);

CREATE OR REPLACE FUNCTION public.get_staff_merchant_access(p_user_id uuid)
RETURNS TABLE(merchant_id uuid, business_name text, staff_role text, permissions jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ms.merchant_id, m.business_name, ms.role, ms.permissions
  FROM public.merchant_staff ms
  JOIN public.merchants m ON m.id = ms.merchant_id
  WHERE ms.user_id = p_user_id
    AND ms.is_active = true
    AND m.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_merchant_access(uuid) TO authenticated, anon;