## Dedicated Agent Analytics Page + Menu Cleanup

### Overview

Create a full-page `/agent/analytics` route with interactive charts (recharts) showing transaction trends, commission breakdown, and peak hours. Remove irrelevant transaction types and the "Transaction Limits" menu item.

### New File: `src/pages/AgentAnalyticsPage.tsx`

A dedicated page that fetches up to 1000 completed transactions for the agent, then renders:

1. **Summary Cards** — Total transactions, volume, commission (filterable by Daily/Weekly/Monthly/All-time tabs)
2. **Transaction Trend Chart** (AreaChart) — Groups transactions by day, showing volume and commission over time. Tabs switch between 7-day, 30-day, This Month, Previous Month and all-time views.
3. **Commission Breakdown by Type** (BarChart) — Horizontal bars showing commission earned per type: Cash In, Cash Out, Received, B2B, Bank Transfer, Bill Pay, Customer Registration.
4. **Peak Hours Analysis** (BarChart) — Groups transactions by hour of day (0-23) to show when the agent is busiest.
5. **Transaction Type Distribution** — Cards showing count/volume/commission per relevant type.

**Relevant types only**: `cashin`, `cashout`, `commission`, `b2b`, `banktransfer`, `paybill`. Explicitly filter out `addmoney`, `send`, `payment`, `recharge`.

### Changes to `AgentMenuDrawer.tsx`

1. **Remove "Transaction Limits"** menu item entirely
2. **Change "Analytics" action** to navigate to `/agent/analytics` instead of opening the bottom sheet
3. **Remove the analytics sheet** code (state, useMemo, Sheet JSX) — no longer needed since we have a dedicated page
4. **Clean up** `typeIcons`/`typeLabels` to only include agent-relevant types
5. Fee Not applicable for agents, agent will get commission as per rules

### Changes to `App.tsx`

Add route:

```tsx
<Route path="/agent/analytics" element={<RoleGuard roles={["agent", "admin"]}><AgentAnalyticsPage /></RoleGuard>} />
```

### Technical Details

- Uses `recharts` (already installed): `AreaChart`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`
- Fetches transactions from Supabase filtered by `user_id` and `status = 'completed'`
- Groups by date using `date-fns` (already installed) for trend charts
- Peak hours computed by extracting hour from `created_at`
- Page header with back arrow navigating to `/agent`
- Mobile-first responsive layout matching existing dashboard design tokens