ALTER TABLE public.savings_auto_save REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.savings_auto_save;