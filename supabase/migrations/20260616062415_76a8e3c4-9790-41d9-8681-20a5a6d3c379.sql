
-- 1. Hide easypay_uid from client roles (admins read via SECURITY DEFINER RPCs below)
REVOKE SELECT (easypay_uid) ON public.profiles FROM anon, authenticated;

-- 2. Admin RPC: batch fetch easypay_uids for a list of user ids
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
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT p.user_id, p.easypay_uid
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_easypay_uids(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_easypay_uids(uuid[]) TO authenticated;

-- 3. Admin RPC: look up a single user by EasyPay UID (case-insensitive)
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
REVOKE ALL ON FUNCTION public.admin_get_user_by_easypay_uid(text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_user_by_easypay_uid(text) TO authenticated;

-- 4. Add easypay_uid snapshot to user_activity_logs
ALTER TABLE public.user_activity_logs
  ADD COLUMN IF NOT EXISTS easypay_uid text;

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_easypay_uid
  ON public.user_activity_logs (easypay_uid);

-- Backfill from current profiles
UPDATE public.user_activity_logs l
SET easypay_uid = p.easypay_uid
FROM public.profiles p
WHERE l.user_id = p.user_id AND l.easypay_uid IS NULL;

-- 5. Update log_user_activity RPC to populate easypay_uid
CREATE OR REPLACE FUNCTION public.log_user_activity(_events jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _ip text := COALESCE(
    NULLIF(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
    current_setting('request.headers', true)::json->>'cf-connecting-ip'
  );
  _ua text := current_setting('request.headers', true)::json->>'user-agent';
  _ep text;
  _count integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT easypay_uid INTO _ep FROM public.profiles WHERE user_id = _uid LIMIT 1;

  INSERT INTO public.user_activity_logs (
    user_id, session_id, event_type, event_name, route, target, metadata,
    device_fingerprint, user_agent, ip_address, easypay_uid, created_at
  )
  SELECT
    _uid,
    e->>'session_id',
    COALESCE(e->>'event_type', 'custom'),
    COALESCE(e->>'event_name', 'unknown'),
    e->>'route',
    e->>'target',
    COALESCE(e->'metadata', '{}'::jsonb),
    e->>'device_fingerprint',
    _ua,
    _ip,
    _ep,
    COALESCE((e->>'created_at')::timestamptz, now())
  FROM jsonb_array_elements(_events) e;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$function$;
