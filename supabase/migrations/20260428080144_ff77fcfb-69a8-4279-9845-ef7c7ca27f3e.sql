-- 1. Helper: notify a freshly-linked staff row
CREATE OR REPLACE FUNCTION public.notify_linked_staff(p_user_id uuid, p_merchant_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_business text;
BEGIN
  IF p_user_id IS NULL OR p_merchant_id IS NULL THEN RETURN; END IF;
  SELECT business_name INTO v_business FROM public.merchants WHERE id = p_merchant_id;
  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (
    p_user_id,
    'You''re now a ' || COALESCE(p_role, 'Staff') || ' at ' || COALESCE(v_business, 'a merchant store'),
    'Open the Merchant Login page, switch to "Merchant Manager" and sign in with your PIN.',
    'system',
    jsonb_build_object('merchant_id', p_merchant_id, 'role', p_role, 'kind', 'staff_linked')
  );
END;
$$;

-- 2. Update existing resolve_staff_user trigger to also notify on link
CREATE OR REPLACE FUNCTION public.resolve_staff_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_user_id uuid;
BEGIN
  v_old_user_id := NEW.user_id;
  SELECT p.user_id INTO NEW.user_id
  FROM public.profiles p
  WHERE p.phone = regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');

  -- If we just linked (or re-linked to a different user), notify them
  IF NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM v_old_user_id THEN
    PERFORM public.notify_linked_staff(NEW.user_id, NEW.merchant_id, NEW.role);
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Backfill on profile insert/phone change: link any waiting staff rows
CREATE OR REPLACE FUNCTION public.backfill_staff_user_on_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_norm text;
  r RECORD;
BEGIN
  v_norm := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');
  IF v_norm = '' OR NEW.user_id IS NULL THEN RETURN NEW; END IF;

  FOR r IN
    SELECT id, merchant_id, role
    FROM public.merchant_staff
    WHERE user_id IS NULL
      AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_norm
  LOOP
    UPDATE public.merchant_staff SET user_id = NEW.user_id, updated_at = now() WHERE id = r.id;
    PERFORM public.notify_linked_staff(NEW.user_id, r.merchant_id, r.role);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_backfill_staff_user_on_profile ON public.profiles;
CREATE TRIGGER trg_backfill_staff_user_on_profile
AFTER INSERT OR UPDATE OF phone, user_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.backfill_staff_user_on_profile();

-- 4. Lightweight phone lookup for Add Staff sheet (returns name only)
CREATE OR REPLACE FUNCTION public.lookup_easypay_user_by_phone(p_phone text)
RETURNS TABLE(found boolean, full_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_norm text;
BEGIN
  v_norm := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF length(v_norm) < 11 THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT true, p.full_name
  FROM public.profiles p
  WHERE p.phone = v_norm
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_easypay_user_by_phone(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.lookup_easypay_user_by_phone(text) TO authenticated;