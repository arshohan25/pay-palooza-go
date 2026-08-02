SELECT cron.unschedule('loyalty-points-expiry')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'loyalty-points-expiry');

SELECT cron.schedule(
  'loyalty-points-expiry',
  '20 2 * * *',
  $$SELECT public.expire_inactive_loyalty_points();$$
);