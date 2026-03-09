

## Auto-resolve recipient name on manual phone entry in agent flows

### Problem
Currently, recipient name resolution only happens after QR scan. When an agent manually types an 11-digit phone number, no name lookup occurs — the agent sees only the raw number with no confirmation of who they're sending to.

### Changes

**1. `src/pages/AgentCashIn.tsx`**
- Add a `useEffect` that watches `phone` state
- When `phone.length === 11 && phone.startsWith("01")`, call `resolve_transfer_recipient` RPC with `p_flow: "send"`
- Set `resolvedName` on success, clear on failure
- Debounce not needed since it only fires at exactly 11 digits
- Also resolve on `onBlur` if phone is valid and name not yet resolved

**2. `src/pages/AgentB2B.tsx`**
- Same pattern: `useEffect` on phone length reaching 11 valid digits
- Call `resolve_transfer_recipient` with `p_flow: "send"` and display resolved name

### Implementation pattern (both files)
```tsx
useEffect(() => {
  if (phone.length === 11 && phone.startsWith("01")) {
    const resolve = async () => {
      try {
        const { data } = await supabase.rpc("resolve_transfer_recipient", {
          p_identifier: phone, p_flow: "send"
        });
        const res = data as any;
        if (res?.found) setResolvedName(res.recipient_name);
        else setResolvedName("");
      } catch { setResolvedName(""); }
    };
    resolve();
  }
}, [phone]);
```

The existing `onChange` handler already clears `resolvedName` on every keystroke, so stale names are naturally cleared. The `useEffect` triggers the lookup only when the phone reaches a valid 11-digit format.

### Files changed
| File | Change |
|------|--------|
| `AgentCashIn.tsx` | Add `useEffect` to auto-resolve name when 11 digits entered |
| `AgentB2B.tsx` | Add `useEffect` to auto-resolve name when 11 digits entered |

