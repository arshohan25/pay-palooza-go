-- Custom permission presets per merchant
CREATE TABLE public.merchant_permission_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, name)
);

CREATE INDEX idx_merchant_permission_presets_merchant ON public.merchant_permission_presets(merchant_id);

ALTER TABLE public.merchant_permission_presets ENABLE ROW LEVEL SECURITY;

-- Owner-only RLS
CREATE POLICY "Owners can view their presets"
ON public.merchant_permission_presets FOR SELECT
USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Owners can create presets"
ON public.merchant_permission_presets FOR INSERT
WITH CHECK (
  merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "Owners can update their presets"
ON public.merchant_permission_presets FOR UPDATE
USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Owners can delete their presets"
ON public.merchant_permission_presets FOR DELETE
USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

-- Sanitize permissions: strip owner-only and unknown keys; trim name
CREATE OR REPLACE FUNCTION public.validate_merchant_preset()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean JSONB := '{}'::jsonb;
  v_key TEXT;
  v_val BOOLEAN;
  v_allowed TEXT[] := ARRAY[
    'orders_view','orders_manage','refunds_view','refunds_manage','inbox',
    'products_view','products_manage','coupons',
    'transactions','payouts','settlements','mdr',
    'customers_view','analytics','paylinks',
    'qr','store_settings','notifications'
  ];
BEGIN
  NEW.name := btrim(NEW.name);
  IF NEW.name = '' THEN
    RAISE EXCEPTION 'Preset name cannot be empty';
  END IF;
  IF NEW.permissions IS NULL OR jsonb_typeof(NEW.permissions) <> 'object' THEN
    NEW.permissions := '{}'::jsonb;
  END IF;
  FOR v_key, v_val IN SELECT key, (value)::boolean FROM jsonb_each_text(NEW.permissions) LOOP
    IF v_key = ANY(v_allowed) AND v_val IS TRUE THEN
      v_clean := v_clean || jsonb_build_object(v_key, true);
    END IF;
  END LOOP;
  NEW.permissions := v_clean;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_merchant_preset
BEFORE INSERT OR UPDATE ON public.merchant_permission_presets
FOR EACH ROW EXECUTE FUNCTION public.validate_merchant_preset();