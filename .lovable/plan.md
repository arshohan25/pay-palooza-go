

## Merchant Dashboard — Potential Enhancements

The dashboard already covers core merchant needs well. Here are high-value additions ranked by impact:

### 1. Today's Snapshot Card (High Impact)
Add a "Today" summary card between Quick Actions and Revenue cards showing:
- Today's transaction count
- Today's revenue
- Comparison vs yesterday (% up/down arrow)
- Peak hour indicator

This data is already computed (`todayRevenue`, `todayTxns`, `peakLabel`) but not displayed on the overview.

### 2. Customer Insights Mini-Card
Show unique customers count and repeat customer rate on the overview — data already partially computed (`uniqueCustomers`) but not rendered.

### 3. Weekly Revenue Sparkline
The `last7` array is computed but not shown on overview. Add a compact 7-day bar chart below revenue cards for at-a-glance trend.

### 4. Notification/Inbox Badge on Overview
Show unread message count prominently — `totalUnread` from `useChat()` is fetched but only used in the menu. Add a visible badge or card.

### 5. Quick-Access Refund Button
For merchants handling disputes — a "Refund" quick action.

---

### Recommendation
Items 1-3 use **already-computed data** that's sitting unused. Adding them would be zero-cost in terms of queries and would make the overview feel more informative and alive.

### Files Modified
- `src/pages/MerchantDashboard.tsx` — MerchOverview component only

### Scope
- Add "Today's Performance" card with revenue, count, vs-yesterday delta, peak hour
- Render the existing `last7` data as a compact mini bar chart
- Show unique customers count
- All data already available — no new queries needed

