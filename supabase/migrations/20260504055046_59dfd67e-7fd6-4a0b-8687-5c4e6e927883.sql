-- PIN reset chat thread (guest-facing, gated via OTP ticket through edge function)
CREATE TABLE public.merchant_pin_reset_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.merchant_pin_reset_requests(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('merchant','admin','system')),
  sender_admin_id UUID NULL,
  content TEXT NOT NULL,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  read_by_merchant BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_mprm_request_created ON public.merchant_pin_reset_messages (request_id, created_at);
CREATE INDEX idx_mprm_admin_unread ON public.merchant_pin_reset_messages (request_id) WHERE read_by_admin = false;

ALTER TABLE public.merchant_pin_reset_messages ENABLE ROW LEVEL SECURITY;

-- Admins (and other privileged staff that already use has_role) can fully manage
CREATE POLICY "Admins read pin reset messages"
ON public.merchant_pin_reset_messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert pin reset messages"
ON public.merchant_pin_reset_messages
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update pin reset messages"
ON public.merchant_pin_reset_messages
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Realtime
ALTER TABLE public.merchant_pin_reset_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_pin_reset_messages;