

# Redesign Coupon Input — bKash Style

## What Changes

Replace the current collapsible text-link + dashed input with a bKash-inspired coupon input: a persistent, pill-shaped row with a coupon icon on the left, placeholder text "Enter promo code", and a bold "APPLY" text button on the right — always visible in the amount step (no toggle needed). Clean, flat, single-line design.

## Design Reference (bKash Style)

```text
┌─────────────────────────────────────────┐
│ 🎟  Enter promo code              APPLY │
└─────────────────────────────────────────┘
```

- Full-width pill shape (`rounded-xl`) with subtle border
- Left: `Ticket` icon in muted color
- Center: inline input, no separate border, transparent background
- Right: "APPLY" as a bold text button (primary color), not a filled button
- No collapsible toggle — always visible when no coupon is applied
- Error text appears below as a subtle red line
- On success: replaces with applied coupon chip (code + discount + ✕ to remove)

## File Modified

- `src/components/PaymentFlow.tsx` — lines 596–637: replace the toggle + dashed input with the bKash-style persistent pill input

