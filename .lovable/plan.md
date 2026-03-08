

## Plan: Swap Bank Transfer and Refer & Earn Positions

### Changes in `src/components/QuickActions.tsx`

1. **`actionDefs` array (line 32)**: Replace the Refer entry at position 4 with a Bank Transfer entry using `Landmark` icon, blue styling (`rgba(33,150,243,...)`), id `"bank"`, labelKey needs a new key or inline label approach

2. **`moreServices` array (line 40)**: Replace the Bank Transfer entry (first item) with a Refer & Earn entry using `ReferIcon` or a lucide icon, orange gradient

3. **`handleAction` (line 100)**: Change `if (id === "refer") return onRefer()` → `if (id === "bank") return onBankTransfer()`

4. **`handleMoreService` (line 108)**: Change `if (id === "bank") onBankTransfer()` → `if (id === "refer") onRefer()`

5. **i18n label**: Since `actionDefs` uses `labelKey` referencing `t()`, we'll need to use a label key for Bank Transfer. We can use a custom label approach or add a `"bankTransfer"` key. Alternatively, use a direct `label` field with fallback.

Everything else stays exactly the same — no other positions change.

