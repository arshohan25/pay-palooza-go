
-- 1. Update protect_profile_fields trigger to guard kyc_exempt
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
    IF current_user NOT IN ('postgres', 'supabase_admin')
       AND current_setting('role') NOT IN ('service_role', 'rls_none') THEN
      NEW.balance := OLD.balance;
    END IF;
  END IF;

  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    IF current_user NOT IN ('postgres', 'supabase_admin')
       AND current_setting('role') NOT IN ('service_role', 'rls_none') THEN
      NEW.phone := OLD.phone;
    END IF;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    NEW.user_id := OLD.user_id;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_user NOT IN ('postgres', 'supabase_admin')
       AND current_setting('role') NOT IN ('service_role', 'rls_none') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;

  -- Protect kyc_exempt from client-side modification
  IF NEW.kyc_exempt IS DISTINCT FROM OLD.kyc_exempt THEN
    IF current_user NOT IN ('postgres', 'supabase_admin')
       AND current_setting('role') NOT IN ('service_role', 'rls_none') THEN
      NEW.kyc_exempt := OLD.kyc_exempt;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Reset wrongly exempted users (non-admins)
UPDATE profiles SET kyc_exempt = false
WHERE kyc_exempt = true
AND user_id NOT IN (
  SELECT user_id FROM user_roles WHERE role = 'admin'
);

-- 3. Create RPC for admin to toggle kyc_exempt securely
CREATE OR REPLACE FUNCTION public.set_kyc_exempt(target_user_id uuid, exempt boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  UPDATE profiles SET kyc_exempt = exempt WHERE user_id = target_user_id;
END;
$$;
