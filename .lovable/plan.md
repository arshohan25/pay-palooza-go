

## Add recipient name resolution after QR scan in agent flows

### Problem
- **AgentCashIn** and **AgentB2B**: QR scan extracts the phone number but doesn't resolve or display the recipient's name. The user sees only the raw number.
- **CashOutFlow**: Already has full QR→validate→show name→skip to amount. No changes needed.
- **AgentBillPay**: Scans account/meter numbers, not user identifiers — name resolution doesn't apply here.

### Changes

**1. `src/pages/AgentCashIn.tsx`**
- Add `resolvedName` state
- After QR scan extracts the phone, call `resolve_transfer_recipient` RPC with `p_flow: "send"` to get the recipient name
- Display the resolved name below the phone input (e.g., a small green badge: "✓ Customer Name")
- Clear `resolvedName` when phone input changes manually

**2. `src/pages/AgentB2B.tsx`**
- Same pattern: add `resolvedName` state
- After QR scan, resolve via RPC and show the name below the phone input
- Clear on manual phone edit

### UI Pattern (both pages)
```tsx
// After phone input, show resolved name
{resolvedName && (
  <p className="text-xs text-primary font-semibold mt-1 flex items-center gap-1">
    <CheckCircle2 size={12} /> {resolvedName}
  </p>
)}
```

### Files Changed

| File | Change |
|------|--------|
| `AgentCashIn.tsx` | Resolve recipient name after QR scan, display below phone input |
| `AgentB2B.tsx` | Resolve recipient name after QR scan, display below phone input |

