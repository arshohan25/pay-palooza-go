CREATE TABLE public.trusted_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone TEXT NOT NULL,
  device_fp TEXT NOT NULL,
  portal TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trusted_devices_portal_check CHECK (
    portal IN ('user','merchant','agent','distributor','super_distributor')
  ),
  CONSTRAINT trusted_devices_unique UNIQUE (user_id, device_fp, portal)
);

CREATE INDEX idx_trusted_devices_lookup
  ON public.trusted_devices (phone, device_fp, portal);

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

-- Lock down: only service role (edge functions) can touch this table.
CREATE POLICY "No direct access to trusted_devices"
  ON public.trusted_devices
  AS PERMISSIVE
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Admins may view rows for support/audit purposes.
CREATE POLICY "Admins can view trusted devices"
  ON public.trusted_devices
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));