ALTER TABLE public.platform_banks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_banks;