
CREATE TABLE IF NOT EXISTS public.merchant_staff_invite_dispatch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.merchant_staff(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  channel text NOT NULL,
  status text NOT NULL,
  detail text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msid_staff_sent ON public.merchant_staff_invite_dispatch(staff_id, sent_at DESC);

ALTER TABLE public.merchant_staff_invite_dispatch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view their staff invite dispatch" ON public.merchant_staff_invite_dispatch;
CREATE POLICY "Owners view their staff invite dispatch"
ON public.merchant_staff_invite_dispatch FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.notify_owner_staff_active(p_merchant_id uuid, p_staff_name text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_business text;
BEGIN
  IF p_merchant_id IS NULL THEN RETURN; END IF;
  SELECT user_id, business_name INTO v_owner, v_business FROM public.merchants WHERE id = p_merchant_id;
  IF v_owner IS NULL THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (
    v_owner,
    COALESCE(p_staff_name, 'Your staff member') || ' is now active',
    'They completed PIN setup and can sign in as ' || COALESCE(p_role, 'Staff') || ' at ' || COALESCE(v_business, 'your store') || '.',
    'merchant_ops',
    jsonb_build_object('merchant_id', p_merchant_id, 'role', p_role, 'kind', 'staff_pin_setup_complete')
  );
END;
$$;

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

  IF NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM v_old_user_id THEN
    PERFORM public.notify_linked_staff(NEW.user_id, NEW.merchant_id, NEW.role);
    PERFORM public.notify_owner_staff_active(NEW.merchant_id, NEW.name, NEW.role);
  END IF;
  RETURN NEW;
END;
$$;

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
    SELECT id, merchant_id, role, name
    FROM public.merchant_staff
    WHERE user_id IS NULL
      AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_norm
  LOOP
    UPDATE public.merchant_staff SET user_id = NEW.user_id, updated_at = now() WHERE id = r.id;
    PERFORM public.notify_linked_staff(NEW.user_id, r.merchant_id, r.role);
    PERFORM public.notify_owner_staff_active(r.merchant_id, r.name, r.role);
  END LOOP;

  RETURN NEW;
END;
$$;
