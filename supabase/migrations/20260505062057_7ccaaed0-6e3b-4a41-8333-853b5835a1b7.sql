ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_pin_reset_requests;
ALTER TABLE public.merchant_pin_reset_messages REPLICA IDENTITY FULL;
ALTER TABLE public.merchant_pin_reset_requests REPLICA IDENTITY FULL;