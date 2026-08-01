CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean;
BEGIN
  -- service_role / backend definer contexts and admins may change anything.
  is_privileged := (auth.uid() IS NULL)
    OR (current_setting('request.jwt.claim.role', true) = 'service_role')
    OR public.has_role(auth.uid(), 'admin'::app_role);

  IF is_privileged THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.kyc_exempt := COALESCE((SELECT false), false);
    NEW.easypay_uid := NULL;
    NEW.balance := 0;
    NEW.status := 'active';
    NEW.deactivated_at := NULL;
    NEW.deactivated_by := NULL;
    NEW.scheduled_deletion_at := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: pin every sensitive column to its previous value.
  NEW.balance := OLD.balance;
  NEW.phone := OLD.phone;
  NEW.email := OLD.email;
  NEW.status := OLD.status;
  NEW.kyc_exempt := OLD.kyc_exempt;
  NEW.easypay_uid := OLD.easypay_uid;
  NEW.referral_code := OLD.referral_code;
  NEW.user_id := OLD.user_id;
  NEW.deactivated_at := OLD.deactivated_at;
  NEW.deactivated_by := OLD.deactivated_by;
  NEW.scheduled_deletion_at := OLD.scheduled_deletion_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_columns
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_sensitive_columns();