

## Fix: Balance Card — Only Balance Area Should Be Tappable

**Problem**: The balance toggle `motion.button` sits inside a `flex-1 min-w-0` div that stretches across most of the card. Because the button inherits this full width, tapping anywhere on the left ~75% of the card triggers the balance show/hide — making it feel like the whole card is interactive.

**Fix in `src/components/BalanceCard.tsx`**:

1. Change the balance toggle `motion.button` (line 148) from `className="flex items-center group"` to `className="flex items-center group w-fit"` — this constrains the button's clickable area to only the visible pill/balance text, not the full flex width.

2. That's it — single class addition. The QR, Copy, Add Money, and Share buttons already have their own isolated click handlers and will continue working independently.

**No backend changes.**

