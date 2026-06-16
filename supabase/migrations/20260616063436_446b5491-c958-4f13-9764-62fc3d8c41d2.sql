
-- 1. Alert log table
CREATE TABLE IF NOT EXISTS public.easypay_uid_access_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  rpc_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.easypay_uid_access_alerts TO authenticated;
GRANT ALL ON public.easypay_uid_access_alerts TO service_role;

ALTER TABLE public.easypay_uid_access_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read uid alerts" ON public.easypay_uid_access_alerts;
CREATE POLICY "admins read uid alerts"
  ON public.easypay_uid_access_alerts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'compliance'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.easypay_uid_access_alerts;

CREATE INDEX IF NOT EXISTS idx_easypay_uid_alerts_created
  ON public.easypay_uid_access_alerts (created_at DESC);

-- 2. Helper to record one alert (SECURITY DEFINER so it bypasses RLS for inserts)
CREATE OR REPLACE FUNCTION public.log_easypay_uid_access_attempt(_rpc text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ip text := COALESCE(
    NULLIF(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
    current_setting('request.headers', true)::json->>'cf-connecting-ip'
  );
  _ua text := current_setting('request.headers', true)::json->>'user-agent';
  _role text;
BEGIN
  SELECT string_agg(role::text, ',') INTO _role
  FROM public.user_roles WHERE user_id = auth.uid();

  INSERT INTO public.easypay_uid_access_alerts (actor_id, actor_role, rpc_name, payload, ip_address, user_agent)
  VALUES (auth.uid(), COALESCE(_role, 'none'), _rpc, COALESCE(_payload, '{}'::jsonb), _ip, _ua);
END;
$$;

REVOKE ALL ON FUNCTION public.log_easypay_uid_access_attempt(text, jsonb) FROM public;
-- intentionally not granted to authenticated: only invoked from inside admin RPCs

-- 3. Update admin_get_easypay_uids to log non-admin attempts
CREATE OR REPLACE FUNCTION public.admin_get_easypay_uids(_user_ids uuid[])
RETURNS TABLE (user_id uuid, easypay_uid text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT public.has_role(auth.uid(), 'compliance'::app_role) THEN
    PERFORM public.log_easypay_uid_access_attempt(
      'admin_get_easypay_uids',
      jsonb_build_object('user_ids_count', COALESCE(array_length(_user_ids, 1), 0))
    );
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT p.user_id, p.easypay_uid
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids);
END;
$$;

-- 4. Update admin_get_user_by_easypay_uid to log non-admin attempts
CREATE OR REPLACE FUNCTION public.admin_get_user_by_easypay_uid(_uid text)
RETURNS TABLE (
  user_id uuid,
  name text,
  phone text,
  email text,
  balance numeric,
  status text,
  avatar_url text,
  created_at timestamptz,
  easypay_uid text,
  kyc_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT public.has_role(auth.uid(), 'compliance'::app_role) THEN
    PERFORM public.log_easypay_uid_access_attempt(
      'admin_get_user_by_easypay_uid',
      jsonb_build_object('requested_uid', _uid)
    );
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    p.user_id, p.name, p.phone, p.email, p.balance, p.status,
    p.avatar_url, p.created_at, p.easypay_uid,
    CASE WHEN p.kyc_exempt THEN 'exempt'
         ELSE COALESCE(k.status, 'not_started') END AS kyc_status
  FROM public.profiles p
  LEFT JOIN public.kyc_verifications k ON k.user_id = p.user_id
  WHERE upper(p.easypay_uid) = upper(_uid)
  LIMIT 1;
END;
$$;
