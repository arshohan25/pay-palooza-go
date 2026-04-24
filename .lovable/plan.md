# Phase 3 — Web Push, Setup Wizard & Hardened Vendor Tools

A focused upgrade that turns Phase 2's plumbing into a working push system, and tightens the two new merchant sheets so they can't be misused.

---

## 1. Web Push Opt-in Prompt (UI → DB)

**New component**: `src/components/PushOptInPrompt.tsx`
- Glassmorphism bottom-sheet shown after login (24h cooldown via `localStorage` key `push_optin_dismissed_at`).
- Shows only when: user logged in + `Notification.permission === "default"` + `usePushSubscription().supported && configured`.
- Two CTAs: **Enable notifications** (calls `subscribe()`) / **Not now**.
- Mounted in `src/components/AppLayout.tsx` so it appears across customer/merchant/agent shells.

**Hook update**: `src/hooks/use-push-subscription.ts`
- Add `checkExistingSubscription()` on mount — query `pushManager.getSubscription()` and set `subscribed` accurately.
- Add `unsubscribe()` for the wizard test screen.

---

## 2. VAPID Setup Wizard (admin-only)

**New page**: `src/components/admin/AdminPushSetupWizard.tsx` (mounted as a tab in `AdminApiHub` or `AdminSystemSettings`).

4-step accordion UI:
1. **Generate keys** — link + inline command (`npx web-push generate-vapid-keys`) + copy buttons. We can't generate them in-browser without bundling `web-push`, so guide the user.
2. **Store secrets** — instructions to add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:) and `VITE_VAPID_PUBLIC_KEY` (build secret, must match the public one). Status pills check via a new edge function `check-vapid-status`.
3. **Subscribe this device** — calls `subscribe()` from the hook; shows green check on success.
4. **Send test push** — button that invokes `send-push-notification` with `{ user_ids: [adminUserId], title: "Test push ✅", body: "If you see this, push is wired." }`. Surfaces `sent/failed` counts.

**New edge function**: `supabase/functions/check-vapid-status/index.ts` — returns `{ public: bool, private: bool, subject: bool }` so the wizard knows what's configured without exposing values.

---

## 3. DB-to-Push Trigger on Fulfillment Status Changes

**Migration** adds:

```sql
-- Notify trigger on order_item_fulfillments
CREATE OR REPLACE FUNCTION public.notify_fulfillment_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_buyer uuid; v_order_num text; v_event text; v_title text; v_body text;
BEGIN
  SELECT user_id, order_num INTO v_buyer, v_order_num FROM public.orders WHERE id = NEW.order_id;
  IF v_buyer IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_event := 'shipped';
    v_title := 'Order shipped 📦';
    v_body  := format('%s items from #%s shipped via %s', NEW.qty_shipped, v_order_num, COALESCE(NEW.courier_provider,'courier'));
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
    v_event := 'delivered';
    v_title := 'Order delivered ✅';
    v_body  := format('%s items from #%s delivered', NEW.qty_shipped, v_order_num);
  ELSE
    RETURN NEW;
  END IF;

  -- 1) Insert in-app notification
  INSERT INTO public.notifications (user_id, title, body, category, metadata)
  VALUES (v_buyer, v_title, v_body, 'order',
          jsonb_build_object('order_id', NEW.order_id, 'event', v_event, 'tracking', NEW.tracking_number));

  -- 2) Fire web push via pg_net → send-push-notification edge function
  PERFORM net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object(
      'user_ids', jsonb_build_array(v_buyer),
      'title', v_title,
      'body', v_body,
      'url', '/orders/' || NEW.order_id
    )
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_fulfillment
AFTER INSERT OR UPDATE ON public.order_item_fulfillments
FOR EACH ROW EXECUTE FUNCTION public.notify_fulfillment_change();
```

Also adds a `partially_shipped` notification path: when `refresh_order_status_from_fulfillments` flips an order to `partially_shipped`, it sends a single rolled-up push (handled inside the same trigger by checking new aggregate state; or a separate trigger on `orders` status update — preferring the latter for clarity).

Ensures `app.supabase_url` and `app.service_role_key` are set via existing migration helpers (we already use this pattern in `auto-purge-deactivated`).

---

## 4. Hardened FulfillmentSheet (`src/components/merchant/FulfillmentSheet.tsx`)

Client + server validation:
- **Show remaining quantity** prominently per item (large pill: "3 of 5 left to ship") — already partially there, will make it visual + color-coded (green=complete, amber=partial, slate=untouched).
- **Live max enforcement**: clamp the qty input as user types, disable Ship button when invalid.
- **Pre-submit re-fetch**: refresh fulfillments before insert to avoid race when two merchant staff fulfill simultaneously.
- **Backend guard** — new DB trigger:

```sql
CREATE OR REPLACE FUNCTION public.guard_fulfillment_overship()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ordered int; already int;
BEGIN
  SELECT COALESCE((items->NEW.order_item_index->>'qty')::int, 0)
    INTO ordered FROM public.orders WHERE id = NEW.order_id;
  SELECT COALESCE(SUM(qty_shipped),0) INTO already
    FROM public.order_item_fulfillments
    WHERE order_id = NEW.order_id AND order_item_index = NEW.order_item_index
      AND id <> COALESCE(NEW.id, gen_random_uuid());
  IF already + NEW.qty_shipped > ordered THEN
    RAISE EXCEPTION 'Over-ship blocked: % already shipped, ordered %, attempting %',
      already, ordered, NEW.qty_shipped USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_guard_fulfillment_overship
BEFORE INSERT OR UPDATE OF qty_shipped, order_item_index ON public.order_item_fulfillments
FOR EACH ROW EXECUTE FUNCTION public.guard_fulfillment_overship();
```

- Add a sheet-level **summary footer** showing `X / Y items shipped overall` and a "Mark all delivered" bulk action.

---

## 5. Hardened VariantsEditorSheet (`src/components/merchant/VariantsEditorSheet.tsx`)

**Backend constraints** (migration):
- Partial unique index for SKU per product (case-insensitive, ignoring nulls):
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_variant_sku_per_product
    ON public.product_variants (product_id, lower(sku)) WHERE sku IS NOT NULL;
  ```
- Unique constraint on (product_id, variant_name, variant_value) — prevents "Size: M" being added twice:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_variant_attr_per_product
    ON public.product_variants (product_id, lower(variant_name), lower(variant_value));
  ```
- CHECK: `stock >= 0`, `price_adjustment >= -999999` (allow negative for discounts but sane bound).

**UI improvements**:
- **Pre-validation** — before insert, query the current variant list (already loaded) for case-insensitive collisions on SKU and on `variant_name+variant_value`. Show inline red message: "SKU already used" / "This option already exists".
- **Negative-stock guard**: clamp stock input to ≥0; block save with toast if violated.
- **Price-rule warning**: if `price_adjustment` would make `base_price + adjustment <= 0`, show amber warning chip "Final price would be ৳X — please review".
- **Postgres error mapping**: catch `23505` (unique violation) and `23514` (check violation) on insert/update and translate to friendly toasts instead of raw error text.
- Display variant SKU/attributes as monospace pills with a copy button.

---

## 6. Files

**New**
- `src/components/PushOptInPrompt.tsx`
- `src/components/admin/AdminPushSetupWizard.tsx`
- `supabase/functions/check-vapid-status/index.ts`
- `supabase/migrations/<ts>_phase3_push_and_guards.sql`

**Modified**
- `src/components/AppLayout.tsx` — mount `<PushOptInPrompt />`
- `src/hooks/use-push-subscription.ts` — add `checkExistingSubscription`, `unsubscribe`, `sendTest` helper
- `src/components/merchant/FulfillmentSheet.tsx` — visual remaining badges, race-safe submit, error mapping, summary footer
- `src/components/merchant/VariantsEditorSheet.tsx` — duplicate detection, error mapping, price/stock warnings
- `src/pages/AdminDashboard.tsx` (or `AdminApiHub.tsx`) — register the Push Setup Wizard tab

**Memory updates**
- `mem://features/notifications/push` (new) — VAPID flow, db-trigger pattern, opt-in cooldown.

---

## 7. Out of scope (intentional)
- Service worker file itself — we rely on the existing Lovable-generated SW for `pushManager`. If absent, the wizard's "Subscribe this device" step will surface a friendly error and link to enabling PWA install first.
- iOS Safari quirks (requires installed PWA) — we'll surface a hint in the opt-in sheet but not block.

---

**Ready to implement?** Once approved, I'll:
1. Run the new migration (push trigger, over-ship guard, variant unique indexes).
2. Create the wizard, opt-in prompt, and `check-vapid-status` function.
3. Patch the two sheets and hook.
4. Verify with a test push to your account from the wizard.
