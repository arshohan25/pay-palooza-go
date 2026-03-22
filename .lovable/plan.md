

## Add Toggle Keys to Super Distributor Dashboard

### What
The Super Distributor Dashboard has 10 quick actions with no toggle key support. This change adds `toggleKey` to each action, filters them with `useGlobalToggles`, and inserts 10 rows into the database.

### Changes

#### 1. `src/pages/SuperDistributorDashboard.tsx`
- Import `useGlobalToggles`
- Add `toggleKey` to each quick action:

| Action | Toggle Key |
|---|---|
| Create Dist. | `super_distributor_create` |
| Float Send | `super_distributor_float_send` |
| Distributors | `super_distributor_distributors` |
| Dist Txns | `super_distributor_dist_txns` |
| Settle | `super_distributor_settle` |
| Reconcile | `super_distributor_reconcile` |
| Analytics | `super_distributor_analytics` |
| History | `super_distributor_history` |
| Alerts | `super_distributor_alerts` |
| Support | `super_distributor_support` |

- Filter `quickActions` with `isDisabled` before rendering

#### 2. Database Insert
Insert 10 rows into `global_feature_toggles` with `is_enabled = true` and `ON CONFLICT DO NOTHING`.

### Result
All super distributor features become individually controllable from the Admin Global Toggles panel under a new "Other" section (since there's no dedicated super_distributor matcher in AdminGlobalToggles). We should also add a Super Distributor section to the `SECTIONS` array in `AdminGlobalToggles.tsx` so they group properly.

#### 3. `src/components/admin/AdminGlobalToggles.tsx`
- Add a new section entry for Super Distributor with a `Crown` icon, matching keys starting with `super_distributor_`

