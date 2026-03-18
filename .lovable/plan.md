

## Fix: Donation Leaderboard Shows Empty

### Root Cause
The leaderboard fetch is triggered via `onClick` on `TabsTrigger` (line 195), but only when `leaderboard.length === 0`. This pattern is fragile with Radix UI tabs -- the `onClick` may fire before/after the tab switch inconsistently, and there's a stale closure risk where `leaderboard.length` references an outdated value.

Additionally, the `Tabs` component uses `defaultValue="donate"` with no controlled `onValueChange`, so tab switches rely entirely on Radix internals and the `onClick` handler.

### Fix -- `src/pages/DonationsPage.tsx`

**1. Add tab state and `onValueChange` handler**
- Add `const [activeTab, setActiveTab] = useState("donate")`
- Change `<Tabs defaultValue="donate">` to `<Tabs value={activeTab} onValueChange={setActiveTab}`
- Remove the `onClick` handlers from all `TabsTrigger` elements

**2. Add useEffect to fetch leaderboard on tab switch**
```tsx
useEffect(() => {
  if (activeTab === "leaderboard" && leaderboard.length === 0) {
    fetchLeaderboard(leaderboardCause);
  }
  if (activeTab === "recurring" && recurringList.length === 0) {
    fetchRecurring();
  }
}, [activeTab]);
```

This ensures the fetch is triggered reliably when the tab becomes active, using React's state management instead of relying on DOM click events.

### Files
- **Modified**: `src/pages/DonationsPage.tsx` -- controlled tab state with `onValueChange` and `useEffect`-based data fetching

