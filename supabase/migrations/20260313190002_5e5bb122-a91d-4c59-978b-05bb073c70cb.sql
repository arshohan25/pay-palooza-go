INSERT INTO public.payment_gateways (provider, display_name, is_enabled, config, sort_order)
VALUES (
  'npsb',
  'NPSB (National Payment Switch)',
  false,
  '{"API_BASE_URL": "", "API_KEY": "", "API_SECRET": "", "MERCHANT_ID": "", "SIGNING_KEY": ""}'::jsonb,
  10
)
ON CONFLICT DO NOTHING;