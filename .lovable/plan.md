

# Redesign Coupons Page — Premium UI + Flow Linking

## Overview
Rebuild CouponsPage with a premium glassmorphism aesthetic, add an `applicable_flow` column to coupons so each coupon links to its related flow (Shop, Send Money, Payment, etc.), and add a "Use Now" button that navigates the user directly into the relevant flow.

## Database Changes

### Add `applicable_flow` column to `coupons` table
```sql
ALTER TABLE public.coupons ADD COLUMN applicable_flow text DEFAULT 'shop';
```
Allowed values: `shop`, `send_money`, `payment`, `cash_out`, `recharge`, `bill_pay`, `all`. Defaults to `shop`.

## Frontend Changes

### CouponsPage.tsx — Full Redesign

**New Features:**
1. **Category filter tabs** — Horizontal scrollable chips: All, Shop, Send Money, Payment, Recharge, Bill Pay. Filter coupons by `applicable_flow`.
2. **Premium coupon cards** — Glassmorphism card with:
   - Dashed ticket-cut effect on left edge (CSS circle notch)
   - Large discount value with gradient text
   - Flow icon badge showing which service the coupon applies to (ShoppingBag, Send, CreditCard, etc.)
   - Expiry countdown bar (progress indicator of time remaining)
   - "Use Now" primary button + "Copy Code" secondary button
3. **"Use Now" action** — Navigates to the related flow. Mapping:
   - `shop` → `/shop`
   - `send_money` → opens SendMoneyFlow on Index
   - `payment` → opens PaymentFlow on Index
   - `cash_out` → opens CashOutFlow on Index
   - `recharge` → opens MobileRechargeFlow on Index
   - `bill_pay` → opens PayBillFlow on Index
   - For Index flows, navigate to `/?flow=send_money` (or similar) and handle in Index.tsx
4. **Hero section** — Animated gradient banner with confetti sparkle effect, total savings counter
5. **Empty state** — Illustrated with category-specific message

### Index.tsx — Handle `?flow=` query param
Read `flow` query param on mount. If present, auto-open the corresponding sheet (e.g., `setShowSendMoney(true)`). This enables deep-linking from the coupons page.

### Visual Design
- 19px border radius, glassmorphism cards (`bg-card/80 backdrop-blur-sm`)
- Gradient accent on discount text
- Framer Motion stagger animations
- Ticket notch CSS effect using `radial-gradient` pseudo-elements
- Category tabs use glass pill style

## Technical Details
- Coupon interface updated to include `applicable_flow: string`
- Flow mapping object maps flow names to icons + routes
- Filter state managed with `useState<string>("all")`
- Copy and Use Now are separate buttons per card
- AI Reward banner preserved at top

