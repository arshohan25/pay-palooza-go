
-- 1. Ensure unique constraints for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS upazilas_div_dist_up_key ON public.upazilas(division, district, upazila);
CREATE UNIQUE INDEX IF NOT EXISTS unions_div_dist_up_name_type_key ON public.unions(division, district, upazila, name, type);

-- Public read
GRANT SELECT ON public.upazilas TO anon, authenticated;
GRANT SELECT ON public.unions TO anon, authenticated;
GRANT ALL ON public.upazilas TO service_role;
GRANT ALL ON public.unions TO service_role;

-- 2. Hierarchy validator: NULLs pass (allows partial updates that don't touch location cols)
CREATE OR REPLACE FUNCTION public.validate_location_hierarchy(
  _division text, _district text, _upazila text,
  _union_parishad text, _area_type text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _division IS NULL AND _district IS NULL AND _upazila IS NULL THEN
    RETURN TRUE;
  END IF;
  IF _division IS NULL OR _district IS NULL OR _upazila IS NULL THEN
    RETURN FALSE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.upazilas
    WHERE division=_division AND district=_district AND upazila=_upazila AND is_active
  ) THEN
    RETURN FALSE;
  END IF;
  -- Union optional; when provided AND type matches a preloaded row, verify it belongs
  IF _union_parishad IS NOT NULL AND _area_type IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.unions
    WHERE division=_division AND district=_district AND upazila=_upazila
      AND type=_area_type::text
    LIMIT 1
  ) AND NOT EXISTS (
    SELECT 1 FROM public.unions
    WHERE division=_division AND district=_district AND upazila=_upazila
      AND name=_union_parishad AND type=_area_type::text AND is_active
  ) THEN
    -- Preloaded rows exist for this type/upazila but user picked something not in them.
    -- Allow free-text only when NO preloaded rows exist for that type.
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION public.validate_location_hierarchy(text,text,text,text,text) TO anon, authenticated, service_role;

-- 3. Generic trigger
CREATE OR REPLACE FUNCTION public.trg_validate_location_hierarchy()
RETURNS trigger LANGUAGE plpgsql AS $$
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
END $$;

DROP TRIGGER IF EXISTS ma_validate_location ON public.merchant_applications;
CREATE TRIGGER ma_validate_location BEFORE INSERT OR UPDATE ON public.merchant_applications
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_location_hierarchy();

DROP TRIGGER IF EXISTS ag_validate_location ON public.agents;
CREATE TRIGGER ag_validate_location BEFORE INSERT OR UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_location_hierarchy();

DROP TRIGGER IF EXISTS dt_validate_location ON public.distributors;
CREATE TRIGGER dt_validate_location BEFORE INSERT OR UPDATE ON public.distributors
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_location_hierarchy();

-- 4. Apply-once: block INSERT when user already has pending/approved application
CREATE OR REPLACE FUNCTION public.trg_merchant_application_apply_once()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.merchant_applications
    WHERE user_id = NEW.user_id AND status IN ('pending','approved') AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'You already have a merchant application (%). Please wait for review or contact support.', 
      (SELECT status FROM public.merchant_applications WHERE user_id = NEW.user_id AND status IN ('pending','approved') LIMIT 1)
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ma_apply_once ON public.merchant_applications;
CREATE TRIGGER ma_apply_once BEFORE INSERT ON public.merchant_applications
  FOR EACH ROW EXECUTE FUNCTION public.trg_merchant_application_apply_once();

-- 5. check_merchant_apply_access (returns can_apply + status + reason)
CREATE OR REPLACE FUNCTION public.check_merchant_apply_access(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _latest record;
BEGIN
  SELECT status, id, created_at, reason, admin_notes
    INTO _latest
    FROM public.merchant_applications
   WHERE user_id = p_user_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF _latest IS NULL THEN
    RETURN jsonb_build_object('can_apply', true, 'status', null);
  END IF;

  IF _latest.status = 'pending' THEN
    RETURN jsonb_build_object('can_apply', false, 'status', 'pending', 'reason', 'Your application is under review.', 'application_id', _latest.id, 'submitted_at', _latest.created_at);
  ELSIF _latest.status = 'approved' THEN
    RETURN jsonb_build_object('can_apply', false, 'status', 'approved', 'reason', 'You are already an approved merchant.', 'application_id', _latest.id);
  ELSE
    RETURN jsonb_build_object('can_apply', true, 'status', _latest.status, 'reason', COALESCE(_latest.admin_notes, _latest.reason), 'previous_application_id', _latest.id);
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.check_merchant_apply_access(uuid) TO authenticated;
