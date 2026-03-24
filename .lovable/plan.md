

## Plan: Real-time Updates for Currently Online Indicator

### Current State
The `AdminSupportDashboard` polls `getAvailableAgents()` every 30 seconds via `setInterval`. This queries `team_members` (filtered by `department=support`, `is_available=true`) and counts open `support_conversations`.

### Change
Replace the 30-second polling with a Supabase Realtime subscription on the `team_members` table. When any team member's `is_available` status changes, the indicator updates instantly.

### Implementation

**File: `src/components/admin/AdminSupportDashboard.tsx`**

Replace the polling `useEffect` (lines 169-173):

```typescript
// Before:
useEffect(() => {
  fetchOnlineAgents();
  const interval = setInterval(fetchOnlineAgents, 30000);
  return () => clearInterval(interval);
}, [fetchOnlineAgents]);

// After:
useEffect(() => {
  fetchOnlineAgents();
  const ch = supabase.channel("online-agents-rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => fetchOnlineAgents())
    .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => fetchOnlineAgents())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [fetchOnlineAgents]);
```

This listens for any change to `team_members` (availability toggle, new member added) and `support_conversations` (conversation assigned/resolved, affecting open_count) and re-fetches instantly. No database changes needed since `team_members` changes are already propagated via Supabase Realtime.

### Technical Details
- Subscribes to `postgres_changes` on `team_members` and `support_conversations` tables
- Removes the 30-second `setInterval` entirely
- Initial fetch still runs on mount
- Channel is cleaned up on unmount via `removeChannel`
- Single file change, ~5 lines modified

