

## Add Fund Request Summary Card to Admin Overview

### What
Add a summary card in the overview grid showing pending fund requests count and total pending amount, clickable to navigate to the Fund Requests tab.

### How

**Edit `src/pages/AdminDashboard.tsx`:**

1. **Add state** for pending fund request stats (`pendingFundCount`, `pendingFundAmount`) alongside existing stats.

2. **Fetch on load** — query `fund_requests` table filtered by `status = 'pending'`, aggregate count and sum of amounts. Add this to the existing `loadData` / `useEffect` block.

3. **Add realtime listener** — the admin dashboard already subscribes to multiple tables; add `fund_requests` to the existing realtime channel so the card updates live.

4. **Add StatCard** to the overview grid (after the Rewards Paid card):
   - Icon: `CreditCard` (already imported)
   - Label: "Pending Funds"  
   - Value: count + amount display (e.g. "3 / ৳15,000")
   - Color: `bg-rose-500`
   - onClick: navigate to `fund_requests` tab

### Files Changed
- `src/pages/AdminDashboard.tsx` — add fund request stats fetch, realtime subscription, and StatCard in overview grid

