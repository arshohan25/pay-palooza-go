
-- 1. Extend merchant_vendor_applications with photo metadata
ALTER TABLE public.merchant_vendor_applications
  ADD COLUMN IF NOT EXISTS shop_front_photo_meta jsonb,
  ADD COLUMN IF NOT EXISTS shop_inside_photo_meta jsonb;

-- 2. Extend merchant_categories with provenance
ALTER TABLE public.merchant_categories
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS original_input text;

-- Case-insensitive uniqueness on label (defensive)
CREATE UNIQUE INDEX IF NOT EXISTS merchant_categories_label_lower_uidx
  ON public.merchant_categories (lower(label));
CREATE UNIQUE INDEX IF NOT EXISTS merchant_categories_name_lower_uidx
  ON public.merchant_categories (lower(name));

-- 3. Strict add-if-missing with audit
CREATE OR REPLACE FUNCTION public.add_merchant_category_if_missing(
  _label text,
  _strict boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text := btrim(_label);
  v_name  text;
  v_existing text;
  v_max int;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF v_label IS NULL OR length(v_label) = 0 THEN
    RAISE EXCEPTION 'Category label required';
  END IF;
  IF length(v_label) > 80 THEN
    v_label := left(v_label, 80);
  END IF;

  v_name := lower(regexp_replace(v_label, '[^a-zA-Z0-9]+', '_', 'g'));
  v_name := btrim(v_name, '_');
  IF length(v_name) = 0 THEN
    RAISE EXCEPTION 'Invalid category label';
  END IF;

  SELECT name INTO v_existing FROM public.merchant_categories
    WHERE lower(name) = v_name OR lower(label) = lower(v_label)
    LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF _strict THEN
      RAISE EXCEPTION 'Category "%" already exists', v_existing
        USING ERRCODE = 'unique_violation';
    END IF;
    RETURN v_existing;
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) INTO v_max FROM public.merchant_categories;

  INSERT INTO public.merchant_categories (name, label, sort_order, is_active, created_by, original_input)
  VALUES (v_name, v_label, v_max + 10, true, v_uid, _label);

  -- Audit event
  INSERT INTO public.merchant_audit_events (
    merchant_id, merchant_user_id, actor_id, event_type, reason, to_value
  ) VALUES (
    NULL, v_uid, v_uid, 'category_created',
    'Custom category created via Other',
    jsonb_build_object('name', v_name, 'label', v_label, 'original_input', _label)
  );

  RETURN v_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_merchant_category_if_missing(text, boolean) TO authenticated;

-- 4. Admin category management
CREATE OR REPLACE FUNCTION public.admin_rename_merchant_category(
  _old_name text, _new_label text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new_name text;
  v_old_row public.merchant_categories%ROWTYPE;
  v_updated int;
BEGIN
  IF NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF _new_label IS NULL OR btrim(_new_label) = '' THEN
    RAISE EXCEPTION 'New label required';
  END IF;

  SELECT * INTO v_old_row FROM public.merchant_categories WHERE name = _old_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'Category % not found', _old_name; END IF;

  v_new_name := lower(regexp_replace(btrim(_new_label), '[^a-zA-Z0-9]+', '_', 'g'));
  v_new_name := btrim(v_new_name, '_');
  IF v_new_name = '' THEN RAISE EXCEPTION 'Invalid label'; END IF;

  IF v_new_name <> _old_name AND EXISTS (
    SELECT 1 FROM public.merchant_categories WHERE name = v_new_name
  ) THEN
    RAISE EXCEPTION 'Target category name % already exists', v_new_name
      USING ERRCODE = 'unique_violation';
  END IF;

  UPDATE public.merchant_categories
     SET name = v_new_name, label = btrim(_new_label)
   WHERE name = _old_name;

  UPDATE public.merchants SET category = v_new_name WHERE category = _old_name;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  INSERT INTO public.merchant_audit_events (
    actor_id, event_type, from_value, to_value, reason
  ) VALUES (
    v_uid, 'category_renamed',
    jsonb_build_object('name', _old_name, 'label', v_old_row.label),
    jsonb_build_object('name', v_new_name, 'label', btrim(_new_label), 'merchants_updated', v_updated),
    'Admin renamed category'
  );

  RETURN v_new_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_rename_merchant_category(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_merchant_category_active(
  _name text, _active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  UPDATE public.merchant_categories SET is_active = _active WHERE name = _name;
  IF NOT FOUND THEN RAISE EXCEPTION 'Category % not found', _name; END IF;

  INSERT INTO public.merchant_audit_events (actor_id, event_type, to_value, reason)
  VALUES (v_uid, 'category_toggled',
          jsonb_build_object('name', _name, 'is_active', _active),
          CASE WHEN _active THEN 'Category enabled' ELSE 'Category disabled' END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_merchant_category_active(text, boolean) TO authenticated;

-- 5. Vendor shop photo upload audit
CREATE OR REPLACE FUNCTION public.record_vendor_shop_photo_upload(
  _application_id uuid,
  _slot text,             -- 'front' | 'inside'
  _new_path text,
  _new_meta jsonb,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_app public.merchant_vendor_applications%ROWTYPE;
  v_old_path text;
  v_old_meta jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF _slot NOT IN ('front','inside') THEN RAISE EXCEPTION 'Invalid slot %', _slot; END IF;

  SELECT * INTO v_app FROM public.merchant_vendor_applications WHERE id = _application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_app.user_id <> v_uid AND NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _slot = 'front' THEN
    v_old_path := v_app.shop_front_photo_url; v_old_meta := v_app.shop_front_photo_meta;
    UPDATE public.merchant_vendor_applications
       SET shop_front_photo_url = _new_path, shop_front_photo_meta = _new_meta
     WHERE id = _application_id;
  ELSE
    v_old_path := v_app.shop_inside_photo_url; v_old_meta := v_app.shop_inside_photo_meta;
    UPDATE public.merchant_vendor_applications
       SET shop_inside_photo_url = _new_path, shop_inside_photo_meta = _new_meta
     WHERE id = _application_id;
  END IF;

  INSERT INTO public.merchant_audit_events (
    merchant_id, merchant_user_id, actor_id, event_type, from_value, to_value, reason
  ) VALUES (
    v_app.merchant_id, v_app.user_id, v_uid,
    CASE WHEN v_old_path IS NULL THEN 'vendor_photo_uploaded' ELSE 'vendor_photo_reuploaded' END,
    jsonb_build_object('slot', _slot, 'path', v_old_path, 'meta', v_old_meta),
    jsonb_build_object('slot', _slot, 'path', _new_path, 'meta', _new_meta),
    _reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_vendor_shop_photo_upload(uuid, text, text, jsonb, text) TO authenticated;

-- 6. Resubmit vendor photos (one-click)
CREATE OR REPLACE FUNCTION public.merchant_resubmit_vendor_photos(
  _application_id uuid,
  _front_path text, _front_meta jsonb,
  _inside_path text, _inside_meta jsonb,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_app public.merchant_vendor_applications%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  SELECT * INTO v_app FROM public.merchant_vendor_applications WHERE id = _application_id;
  IF NOT FOUND OR v_app.user_id <> v_uid THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_app.status = 'approved' THEN RAISE EXCEPTION 'Approved applications cannot be modified'; END IF;

  PERFORM public.record_vendor_shop_photo_upload(_application_id, 'front',  _front_path,  _front_meta,  _reason);
  PERFORM public.record_vendor_shop_photo_upload(_application_id, 'inside', _inside_path, _inside_meta, _reason);

  UPDATE public.merchant_vendor_applications
     SET status = 'pending', admin_notes = NULL, reviewed_at = NULL, reviewed_by = NULL
   WHERE id = _application_id;

  INSERT INTO public.merchant_audit_events (
    merchant_id, merchant_user_id, actor_id, event_type, reason, to_value
  ) VALUES (
    v_app.merchant_id, v_app.user_id, v_uid, 'vendor_resubmit', _reason,
    jsonb_build_object('application_id', _application_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merchant_resubmit_vendor_photos(uuid, text, jsonb, text, jsonb, text) TO authenticated;
