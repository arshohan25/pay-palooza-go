

## Redesign Agent Analytics Page — Modern Minimalist with Month Navigation

### What Changes

**Rewrite `src/pages/AgentAnalyticsPage.tsx`** with these improvements:

1. **Period Selector Redesign**: Replace the 5-tab bar with 3 clean tabs: **Daily**, **Weekly**, **Monthly**. For Monthly, add left/right `ChevronLeft`/`ChevronRight` arrows to navigate between months (e.g. "← March 2026 →"). Daily shows today, Weekly shows current week.

2. **Agent-only transaction types**: Keep `cashin`, `cashout`, `b2b`, `banktransfer`, `paybill`. Remove `receive` (not an agent operation). Keep the existing `TYPE_META` mapping but cleaned up.

3. **Summary Cards** — Same 3-card grid (Transactions, Volume, Commission) but cleaner: remove icons, use subtle color accents, lighter shadows.

4. **Transaction Trend** (AreaChart) — Volume + Commission lines, no grid lines for minimalism, softer gradient fills, rounded tooltip.

5. **Commission by Type** (horizontal BarChart) — Same logic, cleaner styling with no grid, rounded bars.

6. **Peak Hours** (BarChart) — Simplified, no grid lines, subtle bar color.

7. **Transaction Breakdown** — Type distribution cards, minimal design with thin left color accent instead of icon boxes.

### Key Implementation Detail

```tsx
// Month navigation state
const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 = last month, etc.
const [view, setView] = useState<"daily" | "weekly" | "monthly">("daily");

// For monthly view, compute target month from offset
const targetMonth = addMonths(new Date(), monthOffset);
const monthLabel = format(targetMonth, "MMMM yyyy");

// Filter logic per view
// daily: isToday(d)
// weekly: d >= startOfWeek(now) && d <= now
// monthly: isWithinInterval(d, { start: startOfMonth(targetMonth), end: endOfMonth(targetMonth) })
```

Month arrows only visible when view is "monthly". Left arrow decrements `monthOffset`, right arrow increments (capped at 0 for current month).

### Files Changed
| File | Change |
|------|--------|
| `src/pages/AgentAnalyticsPage.tsx` | Full rewrite with daily/weekly/monthly tabs, month navigation arrows, minimalist styling, agent-only types |

