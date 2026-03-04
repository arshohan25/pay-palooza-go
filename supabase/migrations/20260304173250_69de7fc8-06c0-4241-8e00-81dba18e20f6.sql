-- Fix protect_profile_fields trigger to allow SECURITY DEFINER RPCs to update balance/phone/status
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Balance: only allow changes from postgres/supabase_admin (SECURITY DEFINER) or service_role
  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
    IF current_user NOT IN ('postgres', 'supabase_admin')
       AND current_setting('role') NOT IN ('service_role', 'rls_none') THEN
      NEW.balance := OLD.balance;
    END IF;
  END IF;

  -- Phone: same pattern
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    IF current_user NOT IN ('postgres', 'supabase_admin')
       AND current_setting('role') NOT IN ('service_role', 'rls_none') THEN
      NEW.phone := OLD.phone;
    END IF;
  END IF;

  -- Prevent user_id changes always from client
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    NEW.user_id := OLD.user_id;
  END IF;

  -- Status: same pattern
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_user NOT IN ('postgres', 'supabase_admin')
       AND current_setting('role') NOT IN ('service_role', 'rls_none') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Repair Shohan's balance: add the missing ৳100,000 from the blocked disbursement
UPDATE profiles SET balance = 518756 WHERE phone = '01909709954';