
-- Extend the parent-linkage trigger: super_distributor rows must NEVER have a parent_id.
CREATE OR REPLACE FUNCTION public.enforce_distributor_parent_is_sd()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_is_sd boolean;
  parent_user uuid;
  parent_is_sd boolean;
BEGIN
  -- Is the row being written a Super Distributor?
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'super_distributor'
  ) INTO new_is_sd;

  IF new_is_sd AND NEW.parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Super Distributors cannot have a parent_id — they are always top-level';
  END IF;

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
  ) INTO parent_is_sd;

  IF NOT parent_is_sd THEN
    RAISE EXCEPTION 'parent_id must reference a Super Distributor';
  END IF;

  RETURN NEW;
END;
$$;

-- Clear any legacy data so the new rule is consistent going forward.
UPDATE public.distributors d
SET parent_id = NULL
WHERE parent_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = d.user_id AND ur.role = 'super_distributor'
  );
