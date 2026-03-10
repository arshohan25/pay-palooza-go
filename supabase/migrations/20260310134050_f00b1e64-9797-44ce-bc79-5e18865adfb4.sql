
-- Enable pg_net extension for async HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: notify recipient on receive/cashin transactions
CREATE OR REPLACE FUNCTION public.notify_transaction_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sender_name text;
  v_sender_phone text;
  v_title text;
  v_body text;
  v_supabase_url text;
  v_service_key text;
BEGIN
  -- Only fire for recipient-side transaction types
  IF NEW.type NOT IN ('receive', 'cashin') THEN
    RETURN NEW;
  END IF;

  -- Build notification content using available transaction data
  v_sender_name := COALESCE(NEW.recipient_name, NEW.recipient_phone, 'Someone');
  v_sender_phone := COALESCE(NEW.recipient_phone, '');

  v_title := CASE
    WHEN NEW.type = 'receive' THEN 'Money Received ৳' || NEW.amount::text
    WHEN NEW.type = 'cashin' THEN 'Cash In ৳' || NEW.amount::text
    ELSE 'Transaction ৳' || NEW.amount::text
  END;

  v_body := 'You received ৳' || to_char(NEW.amount, 'FM999,999,999.00') ||
    ' from ' || v_sender_name || '.' ||
    CASE WHEN NEW.balance_after IS NOT NULL
      THEN ' Balance: ৳' || to_char(NEW.balance_after, 'FM999,999,999.00')
      ELSE ''
    END;

  -- 1. Insert in-app notification (picked up by realtime subscription)
  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (
    NEW.user_id,
    v_title,
    v_body,
    'transaction',
    jsonb_build_object(
      'type', 'money_received',
      'txn_type', NEW.type,
      'txn_id', NEW.id,
      'short_id', NEW.short_id,
      'amount', NEW.amount,
      'sender_name', v_sender_name,
      'sender_phone', v_sender_phone
    )
  );

  -- 2. Call notify-recipient edge function via pg_net for SMS
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);

  -- Use direct env vars available in Supabase
  BEGIN
    PERFORM net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/notify-recipient',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'amount', NEW.amount,
        'sender_name', v_sender_name,
        'sender_phone', v_sender_phone,
        'reference', NEW.reference,
        'type', NEW.type,
        'txn_id', NEW.short_id,
        'balance_after', NEW.balance_after,
        'created_at', NEW.created_at
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Don't fail the transaction if SMS dispatch fails
    RAISE WARNING 'notify-recipient HTTP call failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- Create the trigger
CREATE TRIGGER notify_recipient_trigger
AFTER INSERT ON public.transactions
FOR EACH ROW
WHEN (NEW.type IN ('receive', 'cashin'))
EXECUTE FUNCTION public.notify_transaction_recipient();
