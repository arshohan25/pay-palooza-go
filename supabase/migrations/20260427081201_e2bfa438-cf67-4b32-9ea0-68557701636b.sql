
-- Trigger that fires when an API access request status flips to approved/rejected.
-- Inserts an in-app notification and asynchronously calls the
-- notify-api-access-decision edge function to deliver push + email.

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
  v_anon  text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZ3N4eXp5dHNzZGRpamp4YnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTk2MTIsImV4cCI6MjA4NzA5NTYxMn0.E-IM5AMLYeN2DE64NoduoQXVG8DL57T43vjpZ21Ft74';
BEGIN
  -- Only fire when status actually changes to a terminal state
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

  -- 1. In-app notification (always)
  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (
    NEW.user_id,
    v_title,
    v_body,
    'merchant_api',
    jsonb_build_object(
      'type', 'api_access_decision',
      'status', NEW.status,
      'request_id', NEW.id,
      'reviewer_note', NEW.reviewer_note
    )
  );

  -- 2. Async fan-out to edge function for push + email
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'status', NEW.status,
      'reviewer_note', NEW.reviewer_note
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_merchant_api_access_decision ON public.merchant_api_access_requests;

CREATE TRIGGER trg_notify_merchant_api_access_decision
AFTER UPDATE OF status ON public.merchant_api_access_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_merchant_api_access_decision();
