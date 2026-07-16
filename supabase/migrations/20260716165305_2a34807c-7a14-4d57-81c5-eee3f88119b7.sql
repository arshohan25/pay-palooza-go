
-- Enforce that distributors.parent_id must reference a user with the super_distributor role
CREATE OR REPLACE FUNCTION public.enforce_distributor_parent_is_sd()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_user uuid;
  is_sd boolean;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A distributor cannot be its own parent';
  END IF;

  SELECT user_id INTO parent_user
  FROM public.distributors
  WHERE id = NEW.parent_id;

  IF parent_user IS NULL THEN
    RAISE EXCEPTION 'parent_id % does not reference an existing distributor', NEW.parent_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = parent_user AND role = 'super_distributor'
  ) INTO is_sd;

  IF NOT is_sd THEN
    RAISE EXCEPTION 'parent_id must reference a Super Distributor';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_distributor_parent_is_sd ON public.distributors;
CREATE TRIGGER trg_enforce_distributor_parent_is_sd
BEFORE INSERT OR UPDATE OF parent_id ON public.distributors
FOR EACH ROW
EXECUTE FUNCTION public.enforce_distributor_parent_is_sd();

-- Audit-log every distributor / super-distributor creation
CREATE OR REPLACE FUNCTION public.audit_distributor_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_role text;
BEGIN
  SELECT role::text INTO created_role
  FROM public.user_roles
  WHERE user_id = NEW.user_id
    AND role IN ('super_distributor', 'distributor')
  ORDER BY (role = 'super_distributor') DESC
  LIMIT 1;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'distributor_created',
    'distributor',
    NEW.id::text,
    jsonb_build_object(
      'role', COALESCE(created_role, 'distributor'),
      'parent_id', NEW.parent_id,
      'business_name', NEW.business_name,
      'user_id', NEW.user_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_distributor_creation ON public.distributors;
CREATE TRIGGER trg_audit_distributor_creation
AFTER INSERT ON public.distributors
FOR EACH ROW
EXECUTE FUNCTION public.audit_distributor_creation();
