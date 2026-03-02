

## Problem Analysis

The disbursement **did succeed** in the database:
- Treasury balance: ৳9,999,995,000 (correctly debited ৳5,000)
- Rafiq Ahmed's balance: ৳418,756 (credited)
- Transaction record exists (DISB-20260302-064414)

The UI doesn't reflect these changes because:

1. **`platform_treasury` and `treasury_ledger` are not in the Supabase realtime publication.** The AdminTreasury component subscribes to postgres_changes on these tables, but since they're not published, no events fire.

2. **The `loadTreasury()` call after successful disbursement may race with the RPC commit.** The component calls `loadTreasury()` in the success handler, but the realtime fallback doesn't work either.

3. **The user's home page balance** relies on the `profiles` table realtime subscription (which IS enabled), but if the user is on the admin page, the balance store listener may not be active.

## Plan

### 1. Enable realtime for treasury tables (database migration)
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_treasury;
ALTER PUBLICATION supabase_realtime ADD TABLE public.treasury_ledger;
```

### 2. Add a small delay before refetch in AdminTreasury
In `handleSendFunds` success handler, add a brief delay before `loadTreasury()` to ensure the RPC transaction is fully committed before the SELECT queries run. Alternatively, use the response data from the RPC (`new_treasury_balance`, `target_new_balance`) to optimistically update the UI state immediately.

### 3. Update the found user's displayed balance after disbursement
After a successful send, update `foundUser.balance` in state using the `target_new_balance` from the RPC response, so the admin sees the updated recipient balance without needing to re-search.

### Files to change
- **Database migration**: Enable realtime for `platform_treasury` and `treasury_ledger`
- **`src/components/admin/AdminTreasury.tsx`**: Use RPC response data for optimistic update + ensure `loadTreasury()` runs after a short delay

