

# Review: Items to Update

After checking console logs, session replay, and codebase, here's what needs attention:

## 1. Fix: `BgOrbs` forwardRef Warning (Console Warning)
The `BgOrbs` component in `AuthPage.tsx` still triggers "Function components cannot be given refs" — same issue we fixed for `PinCircles`. Needs the same `forwardRef` treatment.

**File:** `src/pages/AuthPage.tsx` — wrap `BgOrbs` with `forwardRef`.

## 2. Apply: Border Radius Reduction (Pending from Last Approved Plan)
The approved plan to change `rounded-3xl` → `rounded-[19px]` on the three main cards was not applied due to the lock file edit. Still needs implementation:

- `src/components/BalanceCard.tsx` — line 96: `rounded-3xl` → `rounded-[19px]`
- `src/components/QuickActions.tsx` — line 437: `rounded-3xl` → `rounded-[19px]`
- `src/components/PromoCard.tsx` — line 12: `rounded-3xl` → `rounded-[19px]`

## Summary
Two items, four files total. Both are small, safe changes.

