
-- 1. Harden protect_easypay_uid trigger: SECURITY DEFINER + search_path, raise on tampering
CREATE OR REPLACE FUNCTION public.protect_easypay_uid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.easypay_uid IS DISTINCT FROM OLD.easypay_uid
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'easypay_uid is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Lock down easypay_uid_access_alerts: no client INSERT, no DELETE, restricted UPDATE
REVOKE INSERT, DELETE, UPDATE ON public.easypay_uid_access_alerts FROM authenticated;
GRANT SELECT ON public.easypay_uid_access_alerts TO authenticated;

DROP POLICY IF EXISTS "admins update uid alerts" ON public.easypay_uid_access_alerts;

-- Explicit deny policies so even if a future GRANT slips in, RLS blocks
CREATE POLICY "no client insert uid alerts"
  ON public.easypay_uid_access_alerts FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "no client delete uid alerts"
  ON public.easypay_uid_access_alerts FOR DELETE TO authenticated
  USING (false);

CREATE POLICY "no client update uid alerts"
  ON public.easypay_uid_access_alerts FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

-- 3. Safe RPC: only update resolved_* fields, only admin/compliance can call
CREATE OR REPLACE FUNCTION public.resolve_easypay_uid_alert(_id uuid, _resolve boolean, _note text DEFAULT NULL)
RETURNS public.easypay_uid_access_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.easypay_uid_access_alerts;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT public.has_role(auth.uid(), 'compliance'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _resolve THEN
    UPDATE public.easypay_uid_access_alerts
       SET resolved_at = now(),
           resolved_by = auth.uid(),
           resolved_note = NULLIF(trim(coalesce(_note,'')), '')
     WHERE id = _id
     RETURNING * INTO _row;
  ELSE
    UPDATE public.easypay_uid_access_alerts
       SET resolved_at = NULL,
           resolved_by = NULL,
           resolved_note = NULL
     WHERE id = _id
     RETURNING * INTO _row;
  END IF;

  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_easypay_uid_alert(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_easypay_uid_alert(uuid, boolean, text) TO authenticated;

-- 4. Cap activity log batches at 500 events / call
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
  _len integer;
BEGIN
  IF _uid IS NULL THEN
    RETURN 0;
  END IF;
  IF jsonb_typeof(_events) <> 'array' THEN
    RAISE EXCEPTION 'events must be a json array';
  END IF;
  _len := jsonb_array_length(_events);
  IF _len > 500 THEN
    RAISE EXCEPTION 'batch too large (max 500 events)';
  END IF;
  IF _len = 0 THEN
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

-- 5. Audit lookup by EasyPay UID inside the RPC itself
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
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Audit successful admin lookup (non-blocking; STABLE allows INSERT via SECURITY DEFINER context)
  BEGIN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'lookup_by_easypay_uid', 'user', NULL,
            jsonb_build_object('requested_uid', _uid));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

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

-- 6. Cron: purge resolved alerts older than 180 days
SELECT cron.schedule(
  'purge-resolved-easypay-uid-alerts',
  '15 3 * * *',
  $$ DELETE FROM public.easypay_uid_access_alerts
     WHERE resolved_at IS NOT NULL AND resolved_at < now() - interval '180 days' $$
);
