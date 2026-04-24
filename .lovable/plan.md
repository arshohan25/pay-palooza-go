## Goal
Right now coupons and gift cards do not properly expire / get marked used after redemption:
- A coupon's `used_count` only increments inside the shop checkout RPC. Send Money / Recharge / Bill Pay / Payment flows that read `pending_coupon` never report usage back, so the coupon stays "fresh" forever.
- There is no per-user redemption cap — one user can reuse the same code repeatedly until the global `usage_limit` is hit.
- Gift cards have `status` ('active'|'redeemed'|'expired') and `redeemed_by` columns but no redemption RPC, no UI button, and no `expires_at`. They never transition off `active`.

This plan closes all of those gaps end-to-end.

---

## 1. Database migration

### 1a. Per-user coupon redemption tracking
- Create `public.coupon_redemptions` table:
  - `id uuid pk`, `coupon_id uuid -> coupons.id`, `user_id uuid`, `flow text`, `txn_id uuid null`, `discount_amount numeric`, `redeemed_at timestamptz default now()`
  - Unique index `(coupon_id, user_id, txn_id)` to prevent double-recording the same transaction.
- Add `per_user_limit integer null` column to `coupons` (null = unlimited per user).
- Enable RLS:
  - Users can `SELECT` their own redemptions.
  - Only service role / SECURITY DEFINER RPCs can `INSERT`.

### 1b. Update `validate_and_apply_coupon` RPC
- Add per-user check: if `per_user_limit` set, count rows in `coupon_redemptions` for `(coupon_id, user_id)` and reject when reached.
- Keep existing global `usage_limit`, `expires_at`, `starts_at`, `min_order_amount` checks.
- Return discount as today (no DB writes — validation only).

### 1c. New `record_coupon_redemption` SECURITY DEFINER RPC
Signature: `(p_code text, p_user_id uuid, p_flow text, p_txn_id uuid, p_discount numeric)`
- Re-validates code is active and not expired.
- Inserts into `coupon_redemptions`.
- Atomically increments `coupons.used_count`.
- If incrementing pushes `used_count >= usage_limit`, also flips `is_active = false` (so it stops appearing on `CouponsPage`).
- Returns `{ recorded: boolean }`. Idempotent on `(coupon_id, user_id, txn_id)` via the unique index.

### 1d. Gift card lifecycle
- Add `expires_at timestamptz` column to `gift_cards` (default `now() + interval '1 year'` for new rows).
- Add `redeem_gift_card(p_code text)` SECURITY DEFINER RPC:
  - Looks up card by `code`.
  - Rejects if `status != 'active'` or `expires_at < now()`.
  - Sets `status = 'redeemed'`, `redeemed_by = auth.uid()`, `redeemed_at = now()`.
  - Inserts a credit into `transactions` for the redeemer (type `gift_card_redeem`, amount = denomination) and updates wallet `balance` (matching the pattern used by other credit flows).
  - Returns `{ success, credited_amount, brand }`.
- Add scheduled job (pg_cron) `expire_gift_cards`: every hour, `UPDATE gift_cards SET status='expired' WHERE status='active' AND expires_at < now()`.
- Add similar `expire_coupons` job: flips `is_active=false` when `expires_at < now()`.

---

## 2. Frontend — coupon usage reporting

Update every flow that reads `getPendingCoupon()` so that after a successful transaction it calls `record_coupon_redemption` with the new transaction id and the discount that was applied. Files to edit:

- `src/pages/ShopCheckoutPage.tsx` — already increments inside `place_shop_order`; keep as-is, but add a call to `record_coupon_redemption` for non-shop branches if any. (Confirm the RPC handles both paths.)
- `src/components/ShopFlow.tsx` — same as above.
- `src/components/SendMoneyFlow.tsx`
- `src/components/MobileRechargeFlow.tsx`
- `src/components/PayBillFlow.tsx`
- `src/components/PaymentFlow.tsx`
- `src/components/CashOutFlow.tsx`

Pattern in each flow's success handler:
```ts
const pending = getPendingCoupon(<flow>);
if (pending && discountApplied > 0 && newTxnId) {
  await supabase.rpc("record_coupon_redemption", {
    p_code: pending.code,
    p_user_id: user.id,
    p_flow: <flow>,
    p_txn_id: newTxnId,
    p_discount: discountApplied,
  });
  clearPendingCoupon();
}
```

## 3. Frontend — `CouponsPage.tsx`
- Filter out coupons where `used_count >= usage_limit` (server already flips `is_active`, but add the client guard for instant reflection before realtime catches up).
- Show a small "Used" pill on coupons the current user has already redeemed up to `per_user_limit` (query `coupon_redemptions` joined to coupons for this user).
- Subscribe via `postgres_changes` on `coupons` so the list updates the moment usage flips it inactive.

## 4. Frontend — Gift cards
### 4a. `GiftCardsPage.tsx`
- In the "My Cards" tab, for each card with `status='active'` and not expired, add a **Redeem** button → calls `redeem_gift_card`. On success: toast confirms credited amount, refresh list, balance updates via existing realtime.
- Visually badge cards: green "Active", gray "Redeemed" (with `redeemed_at` date), red "Expired".
- Hide the Redeem button when `status !== 'active'` or `expires_at < now()`.

### 4b. `AdminGiftCardManagement.tsx`
- Show new `expires_at` column and allow admin to override.
- Already has a "revoke → expired" path; keep as-is.

## 5. Optional polish
- Add `coupon_redemptions` realtime so admin AdminMarketingTools can see live usage.
- Add admin-side per-user redemption cap input on coupon create form.

---

## Files touched
- New migration: tables, columns, RPCs, cron jobs.
- `src/pages/CouponsPage.tsx`, `src/pages/GiftCardsPage.tsx`
- `src/components/SendMoneyFlow.tsx`, `MobileRechargeFlow.tsx`, `PayBillFlow.tsx`, `PaymentFlow.tsx`, `CashOutFlow.tsx`, `ShopFlow.tsx`, `ShopCheckoutPage.tsx`
- `src/components/admin/AdminGiftCardManagement.tsx` (expires_at column)

After this, both products correctly expire / mark-used after every redemption, per-user caps are enforceable, and gift cards become truly redeemable into wallet balance.