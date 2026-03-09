

## Fix: Agent Dashboard showing user transactions in Recent Activity

### Problem
The Agent Dashboard (`src/pages/AgentDashboard.tsx`, line 110) fetches **all** transaction types for the user — no filter applied. This means user-level transactions (Payment, Send, Addmoney) appear in the agent's "Recent Activity" section, as shown in the screenshot.

### Fix

**`src/pages/AgentDashboard.tsx`**

1. **Filter the transaction query** (line 110) to only fetch agent-relevant types:
```tsx
supabase.from("transactions")
  .select("*")
  .eq("user_id", user.id)
  .in("type", ["cashin", "cashout", "banktransfer", "paybill"])
  .order("created_at", { ascending: false })
  .limit(20)
```

2. **Fix the `isCredit` check** (line 455) — for agent types, `cashin` is a credit (customer depositing), not `receive`/`addmoney`:
```tsx
const isCredit = tx.type === "cashin";
```

| File | Change |
|------|--------|
| `src/pages/AgentDashboard.tsx` | Add `.in("type", [...])` filter to query + fix isCredit logic |

