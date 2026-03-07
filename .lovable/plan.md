

## Plan: Add Commission Column to Agent Transaction History Detail View

### Problem
The `commission` field from the database is not mapped into the `Transaction` interface, so it never appears in the detail sheet or receipt — even when `agentView` is active.

### Changes

**File: `src/pages/TransactionHistory.tsx`**

1. **Add `commission` to `Transaction` interface** — add `commission: number` field (line 34).

2. **Map `commission` in the data transform** — add `commission: t.commission` in the mapping (line 119).

3. **Show commission row in detail sheet** (line 528-529) — add a "Commission Earned" row with a `TrendingUp` icon, conditionally shown when `agentView && selectedTx.commission > 0`, styled in primary/green to highlight earnings.

4. **Include commission in Share Receipt rows** (line 604) — add `{ label: "Commission", value: "৳..." }` when commission > 0 and agentView.

5. **Show commission in the list row** (around line 420) — display a small green "Commission: ৳X" label below the fee label when `agentView && tx.commission > 0`.

### Import
Add `TrendingUp` to the lucide-react import (already used in AgentTransactionHistory but needs adding to TransactionHistory).

