

## Fix Recent Activity — Agent Dashboard

### Issues Found

1. **React ref warning on TxnDetailModal**: `AnimatePresence` tries to pass a ref to `TxnDetailModal` and `NotificationPanel`, but they are plain function components. This causes the console error: *"Function components cannot be given refs."* This can cause exit animations to break silently.

2. **Transaction type display is too generic**: Every transaction shows the same `ArrowDownToLine` icon regardless of type (cashin, cashout, banktransfer, paybill). Only `cashin` is treated as credit — `paybill` and `banktransfer` show as debits but use the same rotated icon.

3. **FAQ commission text outdated**: Line 576 says "0.499%" but the correct rate is now "0.49% (Cash In/Out) and 0.019% (Bill Pay)".

### Changes

**File: `src/pages/AgentDashboard.tsx`**

1. **Wrap `TxnDetailModal` with `React.forwardRef`** to fix the AnimatePresence ref warning. Same for `NotificationPanel`.

2. **Improve Recent Activity icons per transaction type**: Use distinct icons/colors for cashin, cashout, banktransfer, paybill instead of a single `ArrowDownToLine`.

3. **Update FAQ commission text** from "0.499%" to "0.49% on Cash In/Out, 0.019% on Bill Pay".

Single file change, no database modifications needed.

