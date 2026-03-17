

## Phase 2 — Escrow & Settlement Engine + Coupon Validation

### Current State

- **Orders table** already has `escrow_status`, `escrow_released_at`, `coupon_id`, `coupon_discount`, `delivery_fee`, `total_vendor_commission`, `total_platform_fee` columns
- **order_items** table exists with `vendor_commission`, `platform_fee` per item
- **coupons** table exists with full schema (code, discount_type, discount_value, max_discount, min_order_amount, merchant_id, usage_limit, used_count, etc.)
- **ShopFlow checkout** currently uses `transferMoney` to a hardcoded "SHOP-EASYPAY" phone — no escrow, no per-vendor split, no coupon DB validation

### What We'll Build

**A. Database: Escrow Settlement RPC + Coupon Validation RPC**

1. **`validate_and_apply_coupon` RPC** (SECURITY DEFINER)
   - Input: coupon code, cart total, optional merchant_id
   - Validates: active, not expired, usage limit not reached, min order amount
   - Returns: discount amount, coupon_id
   - Does NOT increment `used_count` yet (that happens at order placement)

2. **`place_shop_order` RPC** (SECURITY DEFINER) — replaces the client-side `transferMoney` call
   - Atomically: debit buyer wallet, set `escrow_status = 'held'`, insert order + order_items with per-vendor commission split, increment coupon `used_count`
   - Commission: default 5% platform fee per item (configurable), remainder to vendor
   - Does NOT credit vendors yet — money is held in escrow

3. **`release_escrow` RPC** (admin-only SECURITY DEFINER)
   - On delivery confirmation: credits each vendor's wallet (minus platform fee), sets `escrow_status = 'released'`, records in `treasury_ledger` and `commission_logs`

4. **`cancel_order_escrow` RPC** (admin or buyer for pending orders)
   - Refunds buyer wallet, sets `escrow_status = 'refunded'`

**B. Edge Function: `apply-coupon`**
- Lightweight wrapper calling the `validate_and_apply_coupon` RPC
- Returns discount details to the client

**C. Frontend Changes**

1. **ShopFlow checkout refactor** (`src/components/ShopFlow.tsx` lines ~618-677):
   - Replace `transferMoney({ recipientPhone: "SHOP-EASYPAY" })` with `supabase.rpc("place_shop_order", {...})`
   - Pass cart items with merchant_id, coupon_id, delivery address
   - Show escrow badge on order success ("Payment held securely until delivery")

2. **Coupon validation in cart** (ShopFlow ~1144-1166):
   - Replace local promo code logic with real `validate_and_apply_coupon` RPC call
   - Show actual discount from DB (flat or percentage with max cap)

3. **Admin order management** — add "Release Payment" and "Refund" buttons for escrow orders in `AdminOrderManagement.tsx`

### Files

| Action | File |
|--------|------|
| Migration | New RPCs: `validate_and_apply_coupon`, `place_shop_order`, `release_escrow`, `cancel_order_escrow` |
| Create | `supabase/functions/apply-coupon/index.ts` |
| Modify | `src/components/ShopFlow.tsx` — checkout + coupon logic |
| Modify | `src/components/admin/AdminOrderManagement.tsx` — escrow actions |
| Modify | `supabase/config.toml` — add apply-coupon function config |

### Escrow Flow

```text
Buyer places order
  → Wallet debited (amount + delivery fee - coupon discount)
  → Order created with escrow_status = 'held'
  → order_items created with per-vendor commission split

Admin confirms delivery
  → release_escrow called
  → Each vendor wallet credited (subtotal - platform_fee)
  → Platform treasury credited with platform_fee
  → escrow_status = 'released'

Order cancelled (before shipping)
  → cancel_order_escrow called
  → Buyer wallet refunded
  → escrow_status = 'refunded'
```

