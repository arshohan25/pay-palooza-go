

## Add Realtime Subscriptions to Remaining Admin Components

Four admin child components currently load data on mount but lack realtime subscriptions, meaning changes from other admin sessions won't auto-refresh.

### Components to Update

**1. `src/components/admin/AdminChargeConfig.tsx`** — uses `fee_config` table
- Add a `useEffect` with a Supabase channel (`admin-charge-config-realtime`) listening to `fee_config` for `*` events, calling `load()` on change.

**2. `src/components/admin/AdminCommissionSetup.tsx`** — uses `fee_config` table
- Add a `useEffect` with channel `admin-commission-realtime` listening to `fee_config` for `*` events, calling `load()` on change.

**3. `src/components/admin/AdminChargebackHistory.tsx`** — uses `transactions` (type=chargeback) + `audit_logs`
- Add a `useEffect` with channel `admin-chargeback-history-realtime` listening to `transactions` for `*` events, calling `loadData()` on change.

**4. `src/components/admin/AdminPermissions.tsx`** — uses `user_permissions` table
- Add a `useEffect` with channel `admin-permissions-realtime` listening to `user_permissions` for `*` events, calling `load()` on change.

### Pattern

Each addition follows the same pattern already used throughout the codebase:

```typescript
useEffect(() => {
  const channel = supabase
    .channel("channel-name")
    .on("postgres_changes", { event: "*", schema: "public", table: "table_name" }, () => {
      load();
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [load]);
```

### Notes

- `AdminReporting.tsx` is read-only analytics (aggregates of transactions/profiles) — no user action triggers changes there, so realtime is not needed.
- `AdminRechargeAnalytics.tsx` and `AdminRechargeImportExport.tsx` are similarly read-only/utility components.
- No database migrations needed — all referenced tables are already in the realtime publication.

