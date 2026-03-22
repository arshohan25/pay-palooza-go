
-- 1. Loan status change trigger function
CREATE OR REPLACE FUNCTION public.notify_loan_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_title TEXT;
  v_body TEXT;
  v_amount TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_amount := '৳' || NEW.amount::TEXT;

  CASE NEW.status
    WHEN 'approved' THEN
      v_title := 'Loan Application Approved ✅';
      v_body := 'Your loan of ' || v_amount || ' has been approved! Disbursement will follow shortly.';
    WHEN 'rejected' THEN
      v_title := 'Loan Application Rejected ❌';
      v_body := 'Your loan application for ' || v_amount || ' was not approved.';
      IF NEW.admin_notes IS NOT NULL AND NEW.admin_notes != '' THEN
        v_body := v_body || ' Reason: ' || NEW.admin_notes;
      END IF;
    WHEN 'disbursed' THEN
      v_title := 'Loan Disbursed 💰';
      v_body := v_amount || ' has been disbursed to your wallet.';
    WHEN 'repaid' THEN
      v_title := 'Loan Fully Repaid 🎉';
      v_body := 'Your loan of ' || v_amount || ' is fully repaid. Thank you!';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO notifications (user_id, title, body, category, metadata)
  VALUES (
    NEW.user_id,
    v_title,
    v_body,
    'loan',
    jsonb_build_object(
      'loan_id', NEW.id,
      'amount', NEW.amount,
      'status', NEW.status,
      'notes', COALESCE(NEW.admin_notes, '')
    )
  );

  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER tr_loan_status_change
AFTER UPDATE OF status ON public.loan_applications
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_loan_status_change();

-- 2. Insurance expiry warning function (called by pg_cron)
CREATE OR REPLACE FUNCTION public.notify_insurance_expiry()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_policy RECORD;
  v_count INTEGER := 0;
  v_expiry_text TEXT;
BEGIN
  FOR v_policy IN
    SELECT id, user_id, plan_name, expires_at
    FROM insurance_policies
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at BETWEEN now() AND now() + interval '7 days'
  LOOP
    -- Dedup: skip if we already notified about this policy in the last 7 days
    IF EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = v_policy.user_id
        AND category = 'insurance'
        AND metadata->>'policy_id' = v_policy.id::text
        AND created_at > now() - interval '7 days'
    ) THEN
      CONTINUE;
    END IF;

    v_expiry_text := to_char(v_policy.expires_at, 'DD Mon YYYY');

    INSERT INTO notifications (user_id, title, body, category, metadata)
    VALUES (
      v_policy.user_id,
      '⚠️ Insurance Expiring Soon',
      'Your ' || v_policy.plan_name || ' policy expires on ' || v_expiry_text || '. Renew now to stay covered.',
      'insurance',
      jsonb_build_object(
        'policy_id', v_policy.id,
        'plan_name', v_policy.plan_name,
        'expires_at', v_policy.expires_at
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Enable pg_cron extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
