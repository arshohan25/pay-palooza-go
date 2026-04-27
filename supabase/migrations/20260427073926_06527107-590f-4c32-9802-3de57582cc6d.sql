
-- 1. Hide the API Integration tab by default for all merchants
UPDATE public.global_feature_toggles
SET visibility = 'hidden', is_enabled = false
WHERE feature_key = 'merchant_api';

-- 2. Track merchant requests for API access
CREATE TABLE IF NOT EXISTS public.merchant_api_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  merchant_id uuid,
  message text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reviewed_by uuid,
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_macr_user ON public.merchant_api_access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_macr_status ON public.merchant_api_access_requests(status);

ALTER TABLE public.merchant_api_access_requests ENABLE ROW LEVEL SECURITY;

-- Merchants can see/create their own request
CREATE POLICY "Users view own api access requests"
  ON public.merchant_api_access_requests FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own api access request"
  ON public.merchant_api_access_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only admins can update (approve/reject)
CREATE POLICY "Admins update api access requests"
  ON public.merchant_api_access_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete api access requests"
  ON public.merchant_api_access_requests FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_macr_updated_at
  BEFORE UPDATE ON public.merchant_api_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Admin RPC: grant API access to a merchant (sets per-user override + marks request approved)
CREATE OR REPLACE FUNCTION public.grant_merchant_api_access(
  p_user_id uuid,
  p_request_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Upsert the per-user override that unlocks the API tab
  INSERT INTO public.user_feature_overrides (user_id, feature_key, visibility, group_type, group_value)
  VALUES (p_user_id, 'merchant_api', 'visible', NULL, NULL)
  ON CONFLICT DO NOTHING;

  -- Some schemas may not have a unique constraint; ensure there's only one visible row
  UPDATE public.user_feature_overrides
  SET visibility = 'visible'
  WHERE user_id = p_user_id AND feature_key = 'merchant_api';

  IF p_request_id IS NOT NULL THEN
    UPDATE public.merchant_api_access_requests
    SET status = 'approved',
        reviewed_by = v_admin,
        reviewed_at = now(),
        reviewer_note = COALESCE(p_note, reviewer_note)
    WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.grant_merchant_api_access(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_merchant_api_access(uuid, uuid, text) TO authenticated;

-- Admin RPC: revoke
CREATE OR REPLACE FUNCTION public.revoke_merchant_api_access(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_feature_overrides
  WHERE user_id = p_user_id AND feature_key = 'merchant_api';

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_merchant_api_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_merchant_api_access(uuid) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_api_access_requests;
