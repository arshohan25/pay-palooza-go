

# Reduce Border Radius on Main Cards by 5px

## Problem
The main home page cards (Balance Card, Quick Actions, Promo Card) currently use `rounded-3xl` (24px border radius). The user wants to reduce this by 5px to ~19px.

## Changes

1. **`src/components/BalanceCard.tsx`** (line 96) — Change `rounded-3xl` to `rounded-[19px]`
2. **`src/components/QuickActions.tsx`** (line 437) — Change `rounded-3xl` to `rounded-[19px]`
3. **`src/components/PromoCard.tsx`** (line 12) — Change `rounded-3xl` to `rounded-[19px]`

Three single-line class name changes across three files.

