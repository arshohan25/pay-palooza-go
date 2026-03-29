

# Add Admin-Controlled Payment Methods (incl. Cash on Delivery)

## Overview
Create a database-driven payment methods system where admins manage available checkout payment options from the E-Commerce Hub. The shop checkout page dynamically shows only enabled methods.

## Database Changes

### New table: `checkout_payment_methods`
```sql
CREATE TABLE checkout_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,          -- 'wallet', 'cod', 'bkash', 'card'
  label TEXT NOT NULL,               -- 'EasyPay Wallet', 'Cash on Delivery'
  icon TEXT DEFAULT 'wallet',        -- icon identifier
  description TEXT,                  -- 'Pay from your wallet balance'
  is_enabled BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default methods
INSERT INTO checkout_payment_methods (key, label, icon, description, sort_order) VALUES
  ('wallet', 'EasyPay Wallet', 'wallet', 'Pay from your wallet balance', 0),
  ('cod', 'Cash on Delivery', 'truck', 'Pay when you receive your order', 1),
  ('bkash', 'bKash', 'smartphone', 'Pay via bKash mobile banking', 2),
  ('nagad', 'Nagad', 'smartphone', 'Pay via Nagad mobile banking', 3),
  ('card', 'Credit/Debit Card', 'credit-card', 'Pay with Visa or Mastercard', 4);

-- RLS: public read, admin write
ALTER TABLE checkout_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read" ON checkout_payment_methods FOR SELECT USING (true);
CREATE POLICY "Admin can manage" ON checkout_payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

### Update `place_shop_order` RPC
- When `p_payment_method = 'cod'`, skip wallet deduction and set `escrow_status = 'pending_cod'` instead of `'held'`.

## Frontend Changes

### 1. Admin: Payment Methods sub-tab in E-Commerce Hub
**File: `src/components/admin/AdminEcommerceHub.tsx`**
- Add `"payments"` to SubTab type and SUB_TABS array (icon: CreditCard, label: "Payments")
- New `PaymentMethodsTab` component inline — table with toggle switches, edit label/description, reorder

### 2. Checkout: Dynamic payment method selection
**File: `src/pages/ShopCheckoutPage.tsx`**
- Fetch enabled methods from `checkout_payment_methods` table ordered by `sort_order`
- Replace hardcoded wallet-only button with a list of enabled methods
- Update `PaymentMethod` type from `"wallet" | "card"` to `string`
- For `cod`: skip PIN entry, skip balance check, show "No advance payment required" message
- For `wallet`: keep existing balance check + PIN flow
- For `bkash`/`nagad`/`card`: show "Coming soon" badge (disabled)
- Update success screen to show appropriate message per method (e.g., "Pay ৳X on delivery")

### 3. Icon mapping utility
Map icon strings (`wallet`, `truck`, `smartphone`, `credit-card`) to Lucide icons in the checkout UI.

## Summary
- 1 new database table + seed data
- 1 RPC update (COD handling)
- 2 files modified: `AdminEcommerceHub.tsx`, `ShopCheckoutPage.tsx`
- Admin controls which payment methods appear at checkout
- Cash on Delivery works end-to-end without wallet deduction

