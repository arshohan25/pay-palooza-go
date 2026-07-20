
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_provider TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS courier_booking_ref TEXT,
  ADD COLUMN IF NOT EXISTS courier_last_status TEXT,
  ADD COLUMN IF NOT EXISTS courier_last_scan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS courier_eta TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS courier_booked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_tracking_number_idx ON public.orders (tracking_number);

CREATE TABLE IF NOT EXISTS public.courier_tracking_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_provider TEXT NOT NULL,
  tracking_number TEXT,
  status TEXT NOT NULL,
  status_label TEXT,
  location TEXT,
  note TEXT,
  eta TIMESTAMPTZ,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.courier_tracking_events TO authenticated;
GRANT ALL ON public.courier_tracking_events TO service_role;

ALTER TABLE public.courier_tracking_events ENABLE ROW LEVEL SECURITY;

-- Merchants (order owner) and the buyer can read tracking events for their orders
CREATE POLICY "Order stakeholders read tracking events"
ON public.courier_tracking_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = courier_tracking_events.order_id
      AND (
        o.user_id = auth.uid()
        OR o.merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
      )
  )
);

-- Merchants can insert manual/imported events for their orders
CREATE POLICY "Merchant inserts tracking events for own orders"
ON public.courier_tracking_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = courier_tracking_events.order_id
      AND o.merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  )
);

CREATE INDEX IF NOT EXISTS courier_tracking_events_order_idx
  ON public.courier_tracking_events (order_id, scanned_at DESC);

-- Trigger: sync latest status/ETA back to orders row so lists don't need a join
CREATE OR REPLACE FUNCTION public.sync_order_latest_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
     SET courier_last_status = NEW.status,
         courier_last_scan_at = NEW.scanned_at,
         courier_eta = COALESCE(NEW.eta, courier_eta),
         updated_at = now()
   WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_latest_tracking ON public.courier_tracking_events;
CREATE TRIGGER trg_sync_order_latest_tracking
AFTER INSERT ON public.courier_tracking_events
FOR EACH ROW EXECUTE FUNCTION public.sync_order_latest_tracking();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_tracking_events;
