INSERT INTO public.payment_gateways (provider, display_name, is_enabled, config, sort_order)
VALUES ('asthapay', 'AsthaPay', false, '{}'::jsonb, 3)
ON CONFLICT DO NOTHING;