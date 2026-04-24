CREATE TABLE IF NOT EXISTS public.admin_brand_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT auth.uid(),
  updated_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_brand_settings_active ON public.admin_brand_settings(is_active, setting_key);

CREATE OR REPLACE FUNCTION public.set_admin_brand_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_admin_brand_settings_updated_at ON public.admin_brand_settings;
CREATE TRIGGER set_admin_brand_settings_updated_at
BEFORE UPDATE ON public.admin_brand_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_admin_brand_settings_updated_at();

ALTER TABLE public.admin_brand_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized staff can manage brand settings" ON public.admin_brand_settings;
CREATE POLICY "Authorized staff can manage brand settings"
ON public.admin_brand_settings
FOR ALL
TO authenticated
USING (public.is_admin_command_staff())
WITH CHECK (public.is_admin_command_staff());

INSERT INTO public.admin_brand_settings (setting_key, display_name, config, is_active)
VALUES (
  'global',
  'Global EasyPay Brand',
  '{
    "primaryColor": "#10b981",
    "logoLabel": "EasyPay Admin",
    "splashTitle": "Fast secure payments",
    "receiptFooter": "Powered by EasyPay",
    "invoiceBrand": "EasyPay Financial Services",
    "pwaShortName": "EasyPay",
    "festivalDefault": "Auto festival theme",
    "supportContact": "support@easypay.app"
  }'::jsonb,
  true
)
ON CONFLICT (setting_key) DO NOTHING;