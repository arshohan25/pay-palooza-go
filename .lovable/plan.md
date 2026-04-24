# Phase 2 — Vendor Operations & Buyer Trust

Builds on Phase 1 (KYC, commissions, payouts). Focus: product depth, fulfillment logistics, and real-time push.

## 1. Product Variants

### Database
```sql
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES merchant_products(id) ON DELETE CASCADE,
  sku text,
  attributes jsonb NOT NULL,         -- {size:"M", color:"Red"}
  price_adjustment numeric DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON product_variants(product_id);
```
- RLS: vendors manage own (via `merchant_products.merchant_id` join); public read for active.
- Atomic RPC `decrement_variant_stock(p_variant_id, p_qty)` with row-lock + raise on insufficient stock.

### UI
- **MerchantProductsTab**: new "Variants" button on each product → `VariantsEditorSheet` (add/edit attribute combos, per-variant stock & price delta, image upload).
- **ProductDetailPage**: variant pickers (size/color chips); selected variant drives price + stock label + add-to-cart payload (`variant_id`).
- **CartDrawer / CheckoutPage**: line items carry `variant_id`; checkout RPC calls `decrement_variant_stock` instead of product-level stock when present.

## 2. Order Fulfillment & Partial Delivery

### Database
```sql
CREATE TABLE public.order_item_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  order_item_index integer NOT NULL,  -- index into orders.items jsonb
  qty_shipped integer NOT NULL CHECK (qty_shipped > 0),
  tracking_number text,
  courier_provider text,
  status text NOT NULL DEFAULT 'shipped',
  shipped_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  created_by uuid
);
```
- RLS: vendor owns parent order; admin full access.
- Trigger: when sum(qty_shipped) for all items = ordered qty → auto-set `orders.status='shipped'`; when all delivered → `delivered`.

### UI
- **MerchantOrdersTab**: replace single "Advance status" button with a fulfillment sheet — per-line-item qty input, tracking number, courier picker. Shows "2 of 3 items shipped" progress.
- **OrderDetailPage** (buyer): vertical timeline already exists; extend with per-item fulfillment rows + tracking links (Pathao/Steadfast/RedX deep links from `courier_providers` table).

## 3. Web Push Notifications (PWA)

### Database
```sql
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now()
);
```
- RLS: user manages own subscriptions.

### Service Worker & Client
- Extend existing PWA SW with `push` + `notificationclick` handlers.
- New hook `usePushSubscription` — requests permission, registers subscription, upserts to DB.
- Opt-in prompt rendered once after login (dismissible, persisted in localStorage).

### Edge Function `send-push-notification`
- Accepts `{ user_ids[], title, body, url }`.
- Uses `web-push` with VAPID keys (new secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- On 410 Gone → delete stale subscription.

### DB Trigger
- After insert on `notifications` → `pg_net.http_post` to edge function with the recipient's user_id + notification payload.
- Wired so vendor payout approvals, order status changes, and KYC decisions auto-deliver.

## Secrets Required
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (e.g. `mailto:support@easypay.app`)

## Out of Scope (deferred)
- Bulk CSV product upload (already partially exists — revisit Phase 3)
- Vendor-scoped coupons (already implemented)
- Advanced courier API integrations (manual tracking number entry only)

## Files Created/Edited (estimate)
- New: `src/components/merchant/VariantsEditorSheet.tsx`, `src/components/merchant/FulfillmentSheet.tsx`, `src/hooks/use-push-subscription.ts`, `supabase/functions/send-push-notification/index.ts`, 1 migration.
- Edited: `MerchantProductsTab`, `MerchantOrdersTab`, `ProductDetailPage`, `OrderDetailPage`, `CheckoutPage`, `useCart`, service worker, `App.tsx` (push opt-in mount).

Approve to execute. I'll request the VAPID secrets first, then proceed with DB + UI.