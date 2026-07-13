
CREATE OR REPLACE FUNCTION public.notify_merchant_approval_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title text;
  v_body  text;
  v_url   text := 'https://lmgsxyzytssddijjxbzc.supabase.co/functions/v1/notify-merchant-approval';
  v_key   text;
BEGIN
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

  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (
    NEW.user_id, v_title, v_body, 'merchant_ops',
    jsonb_build_object('type','merchant_approval','status',NEW.business_kyc_status,'merchant_id',NEW.id,'business_name',NEW.business_name,'reason',NEW.business_kyc_rejection_reason)
  );

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    body := jsonb_build_object('user_id',NEW.user_id,'merchant_id',NEW.id,'status',NEW.business_kyc_status,'reason',NEW.business_kyc_rejection_reason,'business_name',NEW.business_name)
  );

  RETURN NEW;
END;
$function$;
