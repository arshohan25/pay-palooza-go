## Goal

In the merchant dashboard's "Merchant Services" grid, the four quick actions — **Send Money, Cash Out, Add Bank, Settlement** — are currently always visible and clickable. When a **manager (staff)** is signed in, they must only be able to use each action if the **merchant owner** has granted the matching permission. Owners are unaffected.

## Permission mapping

Map each quick action to an existing permission key from `src/lib/staffPermissions.ts`:

| Action      | Required permission key | Group label                |
|-------------|-------------------------|----------------------------|
| Send Money  | `payouts`               | Money — "Payouts"          |
| Cash Out    | `payouts`               | Money — "Payouts"          |
| Add Bank    | `store_settings`        | Store — "Store settings"   |
| Settlement  | `settlements`           | Money — "Settlements"      |

These keys already exist, are already shown in the owner's "Add/Edit Permissions" sheet (`MerchantStaffTab`), and are already saved on each staff row — no schema or DB changes needed.

(If later we want finer separation between Send Money and Cash Out we can split them, but `payouts` is the closest existing concept and reuses the owner's existing UI without adding new toggles.)

## Behaviour

- **Owner** (`isStaff === false`): all 4 actions visible and enabled. No change.
- **Manager / staff** (`isStaff === true`):
  - Each action is rendered, but if `can(requiredPermission)` is false the tile is shown in a **locked state**:
    - Reduced opacity (~50%), small lock icon overlay on the icon tile
    - `disabled` button — tap does not open the sheet
    - On tap, a toast: *"Ask the store owner to enable this for you."*
  - This keeps the 4-up grid layout intact (no jumping) and makes the restriction obvious without hiding features completely. Matches the existing pattern used elsewhere in the app for permission-gated tabs.

## Implementation

Single file: `src/pages/MerchantDashboard.tsx`.

1. **Pass staff context into `MerchOverview`** — in the parent component, read `isStaff` and `can` from the already-mounted `useStaffAccess()` hook and pass them as props (`isStaff: boolean`, `can: (key: string) => boolean`).

2. **Update `quickActions` array** (around line 1153) to include a `permission` field:
   ```ts
   const quickActions = [
     { icon: Send,          label: "Send Money", permission: "payouts",        ... },
     { icon: HandCoins,     label: "Cash Out",   permission: "payouts",        ... },
     { icon: Landmark,      label: "Add Bank",   permission: "store_settings", ... },
     { icon: CalendarClock, label: "Settlement", permission: "settlements",    ... },
   ];
   ```

3. **Render-time gating** in the grid map (around line 1170):
   ```tsx
   const locked = isStaff && !can(a.permission);
   <motion.button
     disabled={locked}
     onClick={() => locked
       ? toast({ title: "Permission required", description: "Ask the store owner to enable this for you." })
       : a.onClick()}
     className={`... ${locked ? "opacity-50" : ""}`}
   >
     ...icon tile...
     {locked && <Lock size={10} className="absolute -top-1 -right-1 ..." />}
   </motion.button>
   ```

4. **Import** `Lock` from `lucide-react` (already used elsewhere in the file — verify and add if missing).

## Out of scope

- No DB / RLS changes. The DB-level guards on `wallet_transactions`, `merchant_bank_accounts`, and `settlement_*` already enforce ownership; this is purely a UX gate so managers don't tap into a flow they'll be denied at submit time.
- No changes to the owner's permission editor (`MerchantStaffTab`) — the four mapped keys are already shown there.
- No changes to other tabs/menus — those are already filtered by `TAB_TO_PERMISSION` (lines 183, 192).

## Files touched

- `src/pages/MerchantDashboard.tsx` — pass staff props into `MerchOverview`, add `permission` to `quickActions`, lock-state rendering.
