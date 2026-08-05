select cron.schedule(
  'merchant-insights-digest',
  '30 9 * * 1',
  $$select net.http_post(
    url:='https://lmgsxyzytssddijjxbzc.supabase.co/functions/v1/merchant-insights-digest-cron',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZ3N4eXp5dHNzZGRpamp4YnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTk2MTIsImV4cCI6MjA4NzA5NTYxMn0.E-IM5AMLYeN2DE64NoduoQXVG8DL57T43vjpZ21Ft74"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;$$
);