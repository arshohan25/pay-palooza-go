select cron.schedule(
  'merchant-low-stock-notifier',
  '15 * * * *',
  $$
  select net.http_post(
    url := 'https://lmgsxyzytssddijjxbzc.supabase.co/functions/v1/merchant-low-stock-notifier',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);