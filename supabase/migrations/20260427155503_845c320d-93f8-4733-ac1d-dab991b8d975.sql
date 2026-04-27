-- Trigger that fires when a merchant's business KYC status flips to approved/rejected.
-- Inserts an in-app notification and asynchronously calls the
-- notify-merchant-approval edge function to deliver push + email.

CREATE OR REPLACE FUNCTION public.notify_merchant_approval_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body  text;
  v_url   text := 'https://lmgsxyzytssddijjxbzc.supabase.co/functions/v1/notify-merchant-approval';
  v_anon  text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZ3N4eXp5dHNzZGRpamp4YnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTk2MTIsImV4cCI6MjA4NzA5NTYxMn0.E-IM5AMLYeN2DE64NoduoQXVG8DL57T43vjpZ21Ft74';
BEGIN
  -- Only fire on actual transition to a terminal decision
  IF NEW.business_kyc_status IS NOT DISTINCT FROM OLD.business_kyc_status THEN
    RETURN NEW;
  END IF;
  IF NEW.business_kyc_status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.business_kyc_status = 'approved' THEN
    v_title := 'You''re approved 🎉 — start selling';
    v_body  := 'Your vendor account is live. Set your bank details and add products to go live on EasyPay Shop.';
  ELSE
    v_title := 'Vendor application needs changes';
    v_body  := COALESCE(
      NULLIF(trim(NEW.business_kyc_rejection_reason), ''),
      'Please review the feedback in your Merchant dashboard and resubmit.'
    );
  END IF;

  -- 1. In-app notification (always)
  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (
    NEW.user_id,
    v_title,
    v_body,
    'merchant_ops',
    jsonb_build_object(
      'type', 'merchant_approval',
      'status', NEW.business_kyc_status,
      'merchant_id', NEW.id,
      'business_name', NEW.business_name,
      'reason', NEW.business_kyc_rejection_reason
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
      'merchant_id', NEW.id,
      'status', NEW.business_kyc_status,
      'reason', NEW.business_kyc_rejection_reason,
      'business_name', NEW.business_name
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_merchant_approval_decision ON public.merchants;

CREATE TRIGGER trg_notify_merchant_approval_decision
AFTER UPDATE OF business_kyc_status ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.notify_merchant_approval_decision();