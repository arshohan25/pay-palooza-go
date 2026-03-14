

## Fix: Bank Transfer Not Showing in Transaction History

### Root Cause
Two places filter out `banktransfer` transactions:

1. **`src/pages/Index.tsx` line 301** — The history tab passes `filterTypes={["send", "receive", "payment", "recharge", "addmoney"]}` to `TransactionHistory`, missing `"banktransfer"`.

2. **`src/components/TransactionList.tsx` line 202** — `USER_TYPES` already includes `"banktransfer"`, so the recent transactions widget on home is fine. But let me double-check this was actually applied from the previous edit.

### Fix
**`src/pages/Index.tsx` line 301**: Add `"banktransfer"` to the `filterTypes` array:
```tsx
filterTypes={["send", "receive", "payment", "recharge", "addmoney", "banktransfer"]}
```

That's the only change needed. The `TransactionList` component on the home screen already includes `banktransfer` in `USER_TYPES`, and the `TransactionHistory` component already has `banktransfer` in its `CATEGORIES` list — it's just being filtered out by the parent.

### Files Changed
- `src/pages/Index.tsx` — add `"banktransfer"` to filterTypes

