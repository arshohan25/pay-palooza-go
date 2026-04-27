
-- Helper: does this user have approved API access?
CREATE OR REPLACE FUNCTION public.has_merchant_api_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_feature_overrides
    WHERE user_id = _user_id
      AND feature_key = 'merchant_api'
      AND visibility = 'visible'
  );
$$;

REVOKE ALL ON FUNCTION public.has_merchant_api_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_merchant_api_access(uuid) TO authenticated;

-- Tighten merchant_api_keys policies
DROP POLICY IF EXISTS "Merchants create own API keys" ON public.merchant_api_keys;
DROP POLICY IF EXISTS "Merchants read own API keys" ON public.merchant_api_keys;
DROP POLICY IF EXISTS "Merchants update own API keys" ON public.merchant_api_keys;
DROP POLICY IF EXISTS "Merchants delete own API keys" ON public.merchant_api_keys;

CREATE POLICY "Approved merchants read own API keys"
  ON public.merchant_api_keys FOR SELECT
  USING (
    public.has_merchant_api_access(auth.uid())
    AND merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Approved merchants create own API keys"
  ON public.merchant_api_keys FOR INSERT
  WITH CHECK (
    public.has_merchant_api_access(auth.uid())
    AND merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Approved merchants update own API keys"
  ON public.merchant_api_keys FOR UPDATE
  USING (
    public.has_merchant_api_access(auth.uid())
    AND merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Approved merchants delete own API keys"
  ON public.merchant_api_keys FOR DELETE
  USING (
    public.has_merchant_api_access(auth.uid())
    AND merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

-- Tighten merchant_api_requests policies (key requests, not access requests)
DROP POLICY IF EXISTS "Merchants create requests" ON public.merchant_api_requests;
DROP POLICY IF EXISTS "Merchants view own requests" ON public.merchant_api_requests;

CREATE POLICY "Approved merchants view own key requests"
  ON public.merchant_api_requests FOR SELECT
  USING (
    public.has_merchant_api_access(auth.uid())
    AND merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "Approved merchants create key requests"
  ON public.merchant_api_requests FOR INSERT
  WITH CHECK (
    public.has_merchant_api_access(auth.uid())
    AND merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );
