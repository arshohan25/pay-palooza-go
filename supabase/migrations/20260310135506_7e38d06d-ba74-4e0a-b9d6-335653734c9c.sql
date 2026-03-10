
-- Drop old trigger
DROP TRIGGER IF EXISTS notify_recipient_trigger ON public.transactions;

-- Replace function to handle ALL transaction types
CREATE OR REPLACE FUNCTION public.notify_transaction_recipient()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_counterpart text;
  v_title text;
  v_body text;
  v_formatted_amount text;
  v_balance_str text;
BEGIN
  v_counterpart := COALESCE(NEW.recipient_name, NEW.recipient_phone, 'Someone');
  v_formatted_amount := to_char(NEW.amount, 'FM999,999,999.00');
  v_balance_str := CASE WHEN NEW.balance_after IS NOT NULL
    THEN ' Balance: ৳' || to_char(NEW.balance_after, 'FM999,999,999.00')
    ELSE ''
  END;

  -- Build title and body per type
  CASE NEW.type
    WHEN 'send' THEN
      v_title := 'Sent ৳' || NEW.amount::text;
      v_body := 'You sent ৳' || v_formatted_amount || ' to ' || v_counterpart || '.' || v_balance_str;
    WHEN 'receive' THEN
      v_title := 'Money Received ৳' || NEW.amount::text;
      v_body := 'You received ৳' || v_formatted_amount || ' from ' || v_counterpart || '.' || v_balance_str;
    WHEN 'cashout' THEN
      v_title := 'Cash Out ৳' || NEW.amount::text;
      v_body := 'Cash out of ৳' || v_formatted_amount || ' completed.' || v_balance_str;
    WHEN 'cashin' THEN
      v_title := 'Cash In ৳' || NEW.amount::text;
      v_body := 'Cash in of ৳' || v_formatted_amount || ' received.' || v_balance_str;
    WHEN 'payment' THEN
      v_title := 'Payment ৳' || NEW.amount::text;
      v_body := 'Payment of ৳' || v_formatted_amount || ' to ' || v_counterpart || '.' || v_balance_str;
    WHEN 'recharge' THEN
      v_title := 'Recharge ৳' || NEW.amount::text;
      v_body := 'Recharge of ৳' || v_formatted_amount || ' completed.' || v_balance_str;
    WHEN 'paybill' THEN
      v_title := 'Bill Pay ৳' || NEW.amount::text;
      v_body := 'Bill payment of ৳' || v_formatted_amount || ' completed.' || v_balance_str;
    WHEN 'banktransfer' THEN
      v_title := 'Bank Transfer ৳' || NEW.amount::text;
      v_body := 'Bank transfer of ৳' || v_formatted_amount || ' completed.' || v_balance_str;
    WHEN 'addmoney' THEN
      v_title := 'Money Added ৳' || NEW.amount::text;
      v_body := '৳' || v_formatted_amount || ' added to your wallet.' || v_balance_str;
    WHEN 'chargeback' THEN
      v_title := 'Chargeback ৳' || NEW.amount::text;
      v_body := '৳' || v_formatted_amount || ' deducted (chargeback).' || v_balance_str;
    ELSE
      v_title := 'Transaction ৳' || NEW.amount::text;
      v_body := 'Transaction of ৳' || v_formatted_amount || ' processed.' || v_balance_str;
  END CASE;

  -- 1. Insert in-app notification
  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (
    NEW.user_id,
    v_title,
    v_body,
    'transaction',
    jsonb_build_object(
      'type', NEW.type::text,
      'txn_id', NEW.id,
      'short_id', NEW.short_id,
      'amount', NEW.amount,
      'counterpart', v_counterpart
    )
  );

  -- 2. Call notify-recipient edge function via pg_net for SMS
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
        'sender_name', v_counterpart,
        'sender_phone', COALESCE(NEW.recipient_phone, ''),
        'reference', NEW.reference,
        'type', NEW.type,
        'txn_id', NEW.short_id,
        'balance_after', NEW.balance_after,
        'created_at', NEW.created_at
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify-recipient HTTP call failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- Recreate trigger for ALL transaction inserts (no WHEN filter)
CREATE TRIGGER notify_recipient_trigger
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_transaction_recipient();
