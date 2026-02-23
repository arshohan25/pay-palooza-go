
-- Fix: Restrict profiles UPDATE policy to only allow metadata changes (name, avatar_url)
-- Users should NOT be able to update their own balance, phone, user_id, or status

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile metadata"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create a trigger to prevent balance/phone/status/user_id changes from non-service-role
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow changes to name and avatar_url from regular users
  -- Balance changes must go through RPCs (transfer_money, record_transaction)
  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
    -- Check if caller is service_role (RPCs use SECURITY DEFINER which runs as superuser)
    -- Regular users via RLS will hit this trigger
    IF current_setting('role') != 'service_role' AND current_setting('role') != 'rls_none' THEN
      NEW.balance := OLD.balance;
    END IF;
  END IF;
  
  -- Prevent phone changes from client
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    IF current_setting('role') != 'service_role' AND current_setting('role') != 'rls_none' THEN
      NEW.phone := OLD.phone;
    END IF;
  END IF;

  -- Prevent user_id changes
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    NEW.user_id := OLD.user_id;
  END IF;

  -- Prevent status changes from client
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('role') != 'service_role' AND current_setting('role') != 'rls_none' THEN
      NEW.status := OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();
