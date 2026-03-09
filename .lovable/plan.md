

## Add Commission Rate Details to Agent Transaction History

### What to change

The user wants to show the commission **rate** alongside the commission amount — specifically:
- Cash In / Cash Out: **0.485%**
- Bill Pay: **0.0201%**

These rates should appear in:
1. **Tooltip icon** on each transaction row — e.g. "Commission: ৳57.5 (0.485%)"
2. **Detail sheet** when viewing full transaction — show rate alongside earned amount

### Files to edit

**`src/pages/TransactionHistory.tsx`**

1. **Define commission rate map** (new constant near top):
```tsx
const AGENT_COMMISSION_RATES: Record<string, number> = {
  cashin: 0.485,
  cashout: 0.485,
  paybill: 0.0201,
};
```

2. **Transaction row tooltip** (~line 458-459): Add rate to tooltip text:
```
Commission: ৳{amount} ({rate}%)
```

3. **Transaction row inline text** (~line 443): Same — append rate:
```
Commission: ৳{amount} (0.485%)
```

4. **Detail sheet Commission Earned row** (~line 570): Change value to include rate:
```
+৳{commission} @ {rate}%
```

5. **Detail sheet bottom summary** (~line 604-607): Append rate.

6. **Share receipt** (~line 657): Include rate in commission row.

**`src/pages/AgentTransactionHistory.tsx`**

7. **Earnings Summary Card**: Add a small subtitle under commission showing the rate breakdown, e.g. "Cash In/Out: 0.485% · Bill Pay: 0.0201%"

### Summary

| File | Change |
|------|--------|
| `src/pages/TransactionHistory.tsx` | Add rate map, show rate in tooltip, inline text, detail sheet, receipt |
| `src/pages/AgentTransactionHistory.tsx` | Add rate breakdown subtitle in earnings card |

