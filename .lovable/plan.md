## Phase 3 Close-out — Partial Shipment Push + VAPID Activation

### 1. Migration: partial-shipment trigger on `orders`

Add `notify_order_partial_shipment()` so buyers get one rolled-up alert when an order flips into `partially_shipped` (complementing the per-fulfillment trigger from earlier in Phase 3).

```sql
CREATE OR REPLACE FUNCTION public.notify_order_partial_shipment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body  text;
BEGIN
  IF NEW.status = 'partially_shipped'
     AND COALESCE(OLD.status, '') <> 'partially_shipped' THEN

    v_title := 'Order partially shipped 📦';
    v_body  := format('Some items from order #%s are on the way', NEW.order_num);

    -- In-app notification
    INSERT INTO public.notifications (user_id, title, body, category, metadata)
    VALUES (
      NEW.user_id, v_title, v_body, 'order',
      jsonb_build_object(
        'order_id', NEW.id,
        'event', 'partial',
        'order_num', NEW.order_num,
        'fulfillment_status', 'partial'
      )
    );

    -- Web push via Edge Function
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true)
             || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := jsonb_build_object(
        'user_ids', jsonb_build_array(NEW.user_id),
        'title', v_title,
        'body', v_body,
        'url', '/orders/' || NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_partial ON public.orders;
CREATE TRIGGER trg_notify_order_partial
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_partial_shipment();
```

### 2. VAPID secrets (runtime)

After the migration runs, I'll request these via `add_secret`:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (e.g. `mailto:support@easypay.app`)

Generate with: `npx web-push generate-vapid-keys`

### 3. Build secret (manual)

You'll need to add this yourself in **Workspace Settings → Build Secrets** (tools can't manage build secrets):
- `VITE_VAPID_PUBLIC_KEY` — must exactly match `VAPID_PUBLIC_KEY`

Then republish so the value is baked into the client bundle.

### 4. Verification

1. **Admin → Push Setup wizard** — all status pills should turn green.
2. Click **Subscribe this device** → row appears in `push_subscriptions`.
3. Click **Send test push** → browser notification arrives.
4. Mark a test order item as `shipped` / `delivered` / flip the parent order to `partially_shipped` → confirm in-app + push fire.

### Files

**New**
- `supabase/migrations/<timestamp>_phase3_partial_shipment_push.sql`

**No code changes** — the Edge Function (`send-push-notification`), hook (`use-push-subscription`), wizard (`AdminPushSetupWizard`), and opt-in prompt (`PushOptInPrompt`) are already in place from earlier in Phase 3.
