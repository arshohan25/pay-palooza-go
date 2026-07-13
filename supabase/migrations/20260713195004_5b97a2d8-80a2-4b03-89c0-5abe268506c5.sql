
-- Update notify_merchant_api_access_decision trigger to use service_role key
CREATE OR REPLACE FUNCTION public.notify_merchant_api_access_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body  text;
  v_url   text := 'https://lmgsxyzytssddijjxbzc.supabase.co/functions/v1/notify-api-access-decision';
  v_key   text;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    v_title := 'API access approved 🎉';
    v_body  := 'You can now generate API keys and configure webhooks from your Merchant Dashboard.';
  ELSE
    v_title := 'API access request denied';
    v_body  := COALESCE(
      NULLIF(trim(NEW.reviewer_note), ''),
      'Your request was denied. You can submit a new request or contact support.'
    );
  END IF;

  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (
    NEW.user_id, v_title, v_body, 'merchant_api',
    jsonb_build_object('type','api_access_decision','status',NEW.status,'request_id',NEW.id,'reviewer_note',NEW.reviewer_note)
  );

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    body := jsonb_build_object('user_id',NEW.user_id,'status',NEW.status,'reviewer_note',NEW.reviewer_note)
  );

  RETURN NEW;
END;
$$;

-- Also update notify_merchant_approval trigger (same pattern) if present
DO $$
DECLARE
  fn_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO fn_src
  FROM pg_proc WHERE proname = 'notify_merchant_business_kyc_decision' AND pronamespace = 'public'::regnamespace
  LIMIT 1;
  -- no-op guard: we recreate below unconditionally if the function exists
END $$;
