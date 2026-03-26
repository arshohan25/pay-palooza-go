-- Drop the open SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read merchant apply config" ON public.merchant_apply_config;

-- Create a SECURITY DEFINER function for client-side access checks
CREATE OR REPLACE FUNCTION public.check_merchant_apply_access(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config RECORD;
  v_roles text[];
  v_effective_roles text[];
  v_passes boolean := false;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('can_apply', false);
  END IF;

  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'merchant') THEN
    RETURN jsonb_build_object('can_apply', false);
  END IF;

  SELECT * INTO v_config FROM merchant_apply_config LIMIT 1;
  IF v_config.id IS NULL THEN
    RETURN jsonb_build_object('can_apply', true);
  END IF;

  IF p_user_id = ANY(COALESCE(v_config.blocked_user_ids, '{}')) THEN
    RETURN jsonb_build_object('can_apply', false);
  END IF;

  IF v_config.mode = 'all' THEN
    RETURN jsonb_build_object('can_apply', true);
  ELSIF v_config.mode = 'none' THEN
    RETURN jsonb_build_object('can_apply', false);
  ELSIF v_config.mode = 'targeted' THEN
    IF p_user_id = ANY(COALESCE(v_config.allowed_user_ids, '{}')) THEN
      RETURN jsonb_build_object('can_apply', true);
    END IF;

    SELECT array_agg(role::text) INTO v_roles FROM user_roles WHERE user_id = p_user_id;
    v_effective_roles := COALESCE(v_roles, ARRAY['customer']);

    IF array_length(COALESCE(v_config.allowed_roles, '{}'), 1) > 0 THEN
      IF v_effective_roles && v_config.allowed_roles THEN
        v_passes := true;
      END IF;
      IF 'customer' = ANY(v_effective_roles) AND 'user' = ANY(COALESCE(v_config.allowed_roles, '{}')) THEN
        v_passes := true;
      END IF;
    END IF;

    IF NOT v_passes AND array_length(COALESCE(v_config.allowed_areas, '{}'), 1) > 0 THEN
      IF EXISTS (
        SELECT 1 FROM agents WHERE user_id = p_user_id AND territory_code = ANY(v_config.allowed_areas)
      ) THEN
        v_passes := true;
      END IF;
      IF NOT v_passes THEN
        IF EXISTS (
          SELECT 1 FROM distributors WHERE user_id = p_user_id AND territory && v_config.allowed_areas
        ) THEN
          v_passes := true;
        END IF;
      END IF;
    END IF;

    IF array_length(COALESCE(v_config.allowed_roles, '{}'), 1) IS NULL 
       AND array_length(COALESCE(v_config.allowed_areas, '{}'), 1) IS NULL THEN
      v_passes := false;
    END IF;

    RETURN jsonb_build_object('can_apply', v_passes);
  END IF;

  RETURN jsonb_build_object('can_apply', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_merchant_apply_access FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_merchant_apply_access TO authenticated;