

## Plan: Budget Threshold Alerts (80% and 100%)

### Summary
Add automatic in-app notifications when a user's spending reaches 80% or 100% of their budget limits. Alerts trigger after transaction data is loaded and compared against saved budgets.

### Approach

**Single file change**: `src/pages/SpendingInsightsPage.tsx`

Add a `useEffect` that runs whenever `currentMonthSpending` or `budgets` change (after loading completes). For each budget category with a limit > 0:
- Calculate `pct = (spent / limit) * 100`
- If pct >= 100 → insert a notification: "You've exceeded your {category} budget of ৳{limit}"
- Else if pct >= 80 → insert a notification: "You've used 80% of your {category} budget (৳{spent}/৳{limit})"

**Deduplication**: To avoid spamming the same alert every page load, use a `useRef` set to track which alerts have already been sent this session. Additionally, before inserting, query the `notifications` table for an existing alert this month with matching metadata (`{ type: "budget_alert", category, threshold }`) — if one exists, skip.

**Notification structure**:
```ts
{
  user_id,
  title: "Budget Alert ⚠️" | "Budget Exceeded 🚨",
  body: "You've used 80% of your Send budget (৳4,000/৳5,000)",
  category: "system",
  metadata: { type: "budget_alert", category: "Send", threshold: 80, month: "2026-03" }
}
```

**Toast feedback**: Also show a `toast.warning()` on-screen when a threshold is first crossed during the session.

### Implementation Details

1. Add a `useRef<Set<string>>` to track alerts already fired this session (key: `"{category}-{threshold}"`)
2. After `insightsLoading` becomes false and budgets are loaded, run the check
3. For each category, check 100% first (skip 80% if already at 100%)
4. Query existing notifications for this month to avoid DB duplicates
5. Insert notification + show toast if new

### No database changes needed — uses existing `notifications` table.

