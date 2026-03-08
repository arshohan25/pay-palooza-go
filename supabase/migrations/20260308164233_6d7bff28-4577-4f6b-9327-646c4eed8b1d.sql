
-- Change default expires_at from 30 minutes to 3 minutes
ALTER TABLE public.merchant_payment_sessions 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '3 minutes');

-- Create function to expire stale payment sessions
CREATE OR REPLACE FUNCTION public.expire_stale_payment_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE merchant_payment_sessions
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;
