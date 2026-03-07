

## Plan: Expand More Services & Inline Card Expansion

### What changes

**1. Add more service cards to `MoreSheet.tsx`**
- Add **Loan** (Banknote icon, amber gradient, "coming soon")
- Add **Insurance** (ShieldCheck icon, purple gradient, "coming soon")  
- Add **Gift Cards** (Gift icon, orange gradient, "coming soon")
- Total: 7 items (Bank Transfer, Savings, Coupons, Donations, Loan, Insurance, Gift Cards)
- Make the sheet scrollable to accommodate more items

**2. Inline expansion in QuickActions card**
- Instead of opening a separate bottom sheet overlay, clicking "More" expands the QuickActions card downward with an animated section showing the service grid
- The expanded area shows the same 2-column card grid inside the QuickActions container
- Clicking "More" again (or a collapse button) closes it
- Remove the separate `MoreSheet` bottom sheet overlay approach

**3. Files to modify**
- **`src/components/QuickActions.tsx`** — Add expanded state, render inline More grid below the action icons when expanded. Include all service items with handlers.
- **`src/components/MoreSheet.tsx`** — Remove or keep as unused (the inline expansion replaces it)
- **`src/pages/Index.tsx`** — Pass `onBankTransfer` and `onSavings` callbacks to `QuickActions` instead of `MoreSheet`. Remove `showMore` state and `MoreSheet` rendering.

### Inline expansion layout
```text
┌─────────────────────────────────────┐
│ [Send] [CashOut] [Payment] [Refer]  │
│ [Recharge] [PayBill] [Shop] [More▼] │
│─────────────────────────────────────│
│ ┌──────────┐ ┌──────────┐          │ ← animated expand
│ │Bank Xfer │ │ Savings  │          │
│ ├──────────┤ ├──────────┤          │
│ │ Coupons  │ │Donations │          │
│ ├──────────┤ ├──────────┤          │
│ │  Loan    │ │Insurance │          │
│ ├──────────┤ ├──────────┤          │
│ │Gift Cards│ │          │          │
│ └──────────┘ └──────────┘          │
└─────────────────────────────────────┘
```

### Implementation details
- Use `framer-motion` `AnimatePresence` + `motion.div` with height animation for the expand/collapse
- More button toggles `expanded` state; icon rotates to indicate open/close
- Service cards use the same gradient icon style from current MoreSheet
- "Coming soon" items show a badge and trigger `toast.info("Coming soon!")`

