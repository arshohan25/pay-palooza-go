

# bKash-Style Coupon: Clickable Link → Bottom Sheet with Input + Available Coupons

## What Changes

Replace the inline pill input in PaymentFlow with a bKash-style approach:
1. A clickable text link "🏷 কুপন / প্রোমো কোড" (like bKash's pink link)
2. Tapping it opens a **bottom sheet** with:
   - Header: "কুপন (count)" + "বন্ধ করুন" close button
   - Manual code input row: text field + "যোগ করুন" (Apply) button
   - List of available coupons fetched from DB (same query as CouponsPage) with one-tap apply
   - Empty state illustration if no coupons exist

## Design (from bKash reference)

```text
Payment screen:
  ...
  🏷  কুপন / প্রোমো কোড          ← clickable pink text link
  ...

Bottom sheet (on tap):
┌─────────────────────────────────────┐
│ কুপন (2)                  বন্ধ করুন │
├─────────────────────────────────────┤
│ [ কুপন কোড লিখুন    ] [যোগ করুন]  │
│                                     │
│ ┌─ Available coupon card ─────────┐ │
│ │ 10% OFF  SAVE10  [Apply]       │ │
│ └─────────────────────────────────┘ │
│ ┌─ Available coupon card ─────────┐ │
│ │ ৳50 OFF  FLAT50  [Apply]       │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Files Modified

### 1. `src/components/PaymentFlow.tsx`
- Replace the inline pill input (lines 596–621) with a clickable link: `% কুপন / প্রোমো কোড` in primary color
- Add a `Sheet` (bottom sheet) state toggle
- Inside the sheet:
  - Fetch available coupons from `coupons` table on open (filtered by `is_active`, not expired)
  - Manual input row with "যোগ করুন" button → calls `apply-coupon` edge function
  - List of available coupons as compact cards with one-tap "Apply" that auto-fills and validates
- When a coupon is applied (either manually or from list), close the sheet and set `pendingCoupon`
- When coupon is already applied, show the existing `CouponBanner` instead of the link

### 2. No other files need changes
All coupon logic (validation, banner, store) already exists.

## Technical Notes
- Reuse the `Sheet` component from `@/components/ui/sheet`
- Coupon list query mirrors CouponsPage logic but filters for `applicable_flow` matching "payment" or "all"
- The manual input + Apply flow reuses existing `handleApplyCoupon` logic with merchant validation

