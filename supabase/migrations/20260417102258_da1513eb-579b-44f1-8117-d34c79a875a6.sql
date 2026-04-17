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
  v_desc text;
  v_ref text;
BEGIN
  v_counterpart := COALESCE(NEW.recipient_name, NEW.recipient_phone, 'Someone');
  v_formatted_amount := to_char(NEW.amount, 'FM999,999,999.00');
  v_balance_str := CASE WHEN NEW.balance_after IS NOT NULL
    THEN ' Balance: ৳' || to_char(NEW.balance_after, 'FM999,999,999.00')
    ELSE ''
  END;
  v_desc := COALESCE(NEW.description, '');
  v_ref := COALESCE(NEW.reference, '');

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
      IF NEW.recipient_name IS NULL AND NEW.recipient_phone IS NULL THEN
        IF v_desc LIKE 'Savings Goal:%' THEN
          v_title := 'Goal Deposit ৳' || NEW.amount::text;
          v_body  := '৳' || v_formatted_amount || ' added to "' || trim(substring(v_desc from 15)) || '".' || v_balance_str;
        ELSIF v_desc LIKE 'Gold Purchase:%' THEN
          v_title := 'Gold Purchased ৳' || NEW.amount::text;
          v_body  := 'You bought ' || trim(substring(v_desc from 16)) || ' for ৳' || v_formatted_amount || '.' || v_balance_str;
        ELSIF v_desc LIKE 'Stock Purchase:%' THEN
          v_title := 'Stock Purchased ৳' || NEW.amount::text;
          v_body  := 'You bought ' || trim(substring(v_desc from 17)) || ' for ৳' || v_formatted_amount || '.' || v_balance_str;
        ELSIF v_desc ILIKE 'DPS%' OR v_ref LIKE 'DPS-%' THEN
          v_title := 'DPS Installment ৳' || NEW.amount::text;
          v_body  := '৳' || v_formatted_amount || ' paid to your DPS plan.' || v_balance_str;
        ELSIF v_desc ILIKE 'Loan Repayment%' OR v_ref LIKE 'LOAN-%' THEN
          v_title := 'Loan Repayment ৳' || NEW.amount::text;
          v_body  := '৳' || v_formatted_amount || ' repaid towards your loan.' || v_balance_str;
        ELSIF v_desc ILIKE 'Donation%' OR v_desc ILIKE 'Insurance%' OR v_desc ILIKE 'Gift Card%' THEN
          v_title := 'Payment ৳' || NEW.amount::text;
          v_body  := v_desc || ' — ৳' || v_formatted_amount || '.' || v_balance_str;
        ELSE
          v_title := 'Payment ৳' || NEW.amount::text;
          v_body  := 'Payment of ৳' || v_formatted_amount ||
                     CASE WHEN v_desc <> '' THEN ' for ' || v_desc ELSE '' END || '.' || v_balance_str;
        END IF;
      ELSE
        v_title := 'Payment ৳' || NEW.amount::text;
        v_body := 'Payment of ৳' || v_formatted_amount || ' to ' || v_counterpart || '.' || v_balance_str;
      END IF;
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
      IF v_desc LIKE 'Goal Withdrawal:%' THEN
        v_title := 'Goal Withdrawn ৳' || NEW.amount::text;
        v_body  := '৳' || v_formatted_amount || ' withdrawn from "' || trim(substring(v_desc from 18)) || '" to wallet.' || v_balance_str;
      ELSIF v_desc ILIKE 'DPS Maturity Payout%' THEN
        v_title := 'DPS Matured ৳' || NEW.amount::text;
        v_body  := '🎉 ৳' || v_formatted_amount || ' credited from your matured DPS plan.' || v_balance_str;
      ELSIF v_desc ILIKE 'Gold Sold%' OR v_desc ILIKE 'Stock Sold%' THEN
        v_title := 'Asset Sold ৳' || NEW.amount::text;
        v_body  := v_desc || ' — ৳' || v_formatted_amount || ' credited.' || v_balance_str;
      ELSE
        v_title := 'Money Added ৳' || NEW.amount::text;
        v_body := '৳' || v_formatted_amount || ' added to your wallet.' || v_balance_str;
      END IF;
    WHEN 'chargeback' THEN
      v_title := 'Chargeback ৳' || NEW.amount::text;
      v_body := '৳' || v_formatted_amount || ' deducted (chargeback).' || v_balance_str;
    ELSE
      v_title := 'Transaction ৳' || NEW.amount::text;
      v_body := 'Transaction of ৳' || v_formatted_amount || ' processed.' || v_balance_str;
  END CASE;

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