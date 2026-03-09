

## Unlink Transaction History Pages by Role

Currently, all roles (user, agent, distributor, super-distributor) share the same `TransactionHistory` component and the same `useTransactions()` hook, which pulls from the same `transactions` table filtered by `user_id`. When a person has multiple roles, their transactions overlap across views.

### Problem
- **User history** (Index.tsx) passes NO `filterTypes`, so it shows ALL transaction types including agent-specific ones (cashin, cashout, etc.)
- **Agent history** filters to `["cashin", "cashout", "banktransfer", "paybill"]` but those same transactions also appear in user history
- **Merchant** has its own independent `TxnTab` component (already separate)
- **Distributor / Super-Distributor** filter to `["send", "receive", "addmoney"]` which overlaps with user history

### Solution
Assign each role-view exclusive transaction types so no transaction appears in more than one history:

| View | Filter Types |
|------|-------------|
| **User** (Index.tsx) | `["send", "receive", "payment", "recharge", "addmoney"]` |
| **Agent** (AgentTransactionHistory.tsx) | `["cashin", "cashout", "banktransfer", "paybill"]` (already correct) |
| **Distributor** | `["send", "receive", "addmoney"]` (already set, but could be narrowed if needed) |
| **Super-Distributor** | `["send", "receive", "addmoney"]` (already set) |
| **Merchant** | Already independent (`TxnTab` in MerchantDashboard.tsx) |

### Changes

**`src/pages/Index.tsx`** (~line 275)
- Add `filterTypes={["send", "receive", "payment", "recharge", "addmoney"]}` to the user's `<TransactionHistory>` so it excludes agent-specific types (`cashin`, `cashout`, `banktransfer`, `paybill`).

**`src/components/TransactionList.tsx`** (home page preview list)
- Also filter out agent-specific transaction types from the home screen quick list so the preview matches.

**`src/pages/TransactionHistory.tsx`**
- Update the `CATEGORIES` filter tabs to only show relevant categories when `filterTypes` is provided (already filters data, but category tabs should also be filtered to avoid showing empty tabs like "Cash In" on user view).

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `filterTypes` to user TransactionHistory |
| `src/components/TransactionList.tsx` | Filter out agent types from home preview |
| `src/pages/TransactionHistory.tsx` | Filter category tabs based on `filterTypes` |

