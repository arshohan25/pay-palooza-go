

# Track Performance Based on Outgoing Transactions Only

## Problem
Currently, the `get_user_performance_stats` RPC counts **all** transaction types (including incoming ones like `receive`, `cashin`, `addmoney`). Performance and badge assignment should only reflect **outgoing** activity — transactions the user actively initiates.

## Outgoing Types
`send`, `cashout`, `banktransfer`, `payment`, `recharge`, `paybill`

Excluded (incoming/passive): `receive`, `cashin`, `addmoney`

## Changes

### 1. Update `get_user_performance_stats` RPC (migration)
Add a `WHERE t2.type IN ('send','cashout','banktransfer','payment','recharge','paybill')` filter inside the lateral join so only outgoing transactions are counted for `total_txns`, `monthly_txns`, `total_volume`, `txn_breakdown`, and `last_active`.

### 2. Update badge logic label in frontend
No code change needed — the `getBadge` function uses `total_txns` which will now reflect outgoing-only counts. The thresholds (Power: 50, Active: 20, Basic: 5) remain the same but now measure meaningful user-initiated activity.

### 3. Update activity score tooltip (optional clarity)
Add a small note in the UI that scores are based on outgoing transactions.

## Files Changed
- **New migration** — Update `get_user_performance_stats` to filter by outgoing transaction types only
- `src/components/admin/AdminUserPerformanceTracker.tsx` — Minor label update to clarify "outgoing transactions"

