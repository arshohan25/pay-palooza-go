

## Plan: Budget Alert Notifications at 80% and 100% Thresholds

### Approach

Add budget threshold checking logic to the `useSpendingBudgets` hook. After fetching budgets and spending data, compare each budget's actual spending against its limit. When spending crosses 80% or 100%, insert a notification into the `notifications` table — but only once per threshold per month (tracked via `sessionStorage` to avoid duplicate alerts within the same session, and by checking existing notifications to avoid duplicates across sessions).

### Changes

**File: `src/hooks/use-spending-budgets.ts`**

After the spending aggregation completes (after line 84), add a `checkBudgetAlerts` function that:

1. For each budget, calculate `pct = spending[category] / monthly_limit * 100`
2. If `pct >= 100` → check if a "100% exceeded" notification already exists this month for this category; if not, insert one
3. Else if `pct >= 80` → same check for "80% warning"
4. Use a deduplication query: check `notifications` table for existing alerts with matching `metadata` (category + threshold + month) before inserting
5. Notification format:
   - **80%**: title = "Budget Warning", body = "You've used 80% of your ৳X Send Money budget this month", category = "budget"
   - **100%**: title = "Budget Exceeded", body = "You've exceeded your ৳X Send Money budget this month", category = "budget"
   - `metadata`: `{ category, threshold: 80|100, month: "2026-03" }`

This runs once after each `fetchAll()` call. The notification will appear in the existing NotificationCenter via the real-time subscription already in place.

### Files Modified
- `src/hooks/use-spending-budgets.ts` — add alert check logic (~30 lines after spending aggregation)

