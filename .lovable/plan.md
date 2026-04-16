

# Remove T&C Gate Screen, Move Acceptance Into Creation Flow

## Problem
The full-page T&C gate blocks users from even browsing the Savings dashboard. User wants it removed as an entry barrier and instead shown only during goal/auto-save creation.

## Plan

### Changes to `src/components/SavingsFlow.tsx`

1. **Remove the T&C gate block** (lines 557–735 approx) — delete the entire `if (!tcAccepted)` early return and all related state (`tcAccepted`, `tcChecked`, `localStorage` flag).

2. **Move T&C acceptance into the "review" step** — before the PIN input on the auto-save review/confirmation screen, embed the T&C content (risk warning, fees, sections 1–8) in a collapsible `ScrollArea` with the checkbox. The existing `termsAccepted` state already gates submission — just enhance it with the full T&C content instead of the current minimal checkbox.

3. **For standalone goal creation (no auto-save)** — goals without auto-save don't involve investment, so no T&C is needed. They create directly on button tap (current behavior).

4. **Keep per-trade T&C checkbox** on Gold/Stock confirmation screens (`tradeTermsAccepted`) as-is — these already show inline acceptance.

### Result
- Users can freely browse Savings tabs (Gold, Stocks, Goals)
- T&C acceptance is required only when committing to an auto-save plan (review step) or executing a trade (already done)
- No localStorage gate — acceptance is per-action

