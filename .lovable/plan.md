

## Add Visual "Live Updated" Indicator for Admin Realtime Refreshes

When the admin dashboard or any child component auto-refreshes via realtime, show a subtle, non-intrusive visual indicator so admins know data just synced.

### Approach

**Create a reusable `RealtimeUpdateIndicator` component** that:
- Renders a small pill/badge (e.g., "● Live updated just now") that fades in with a pulse, then fades out after ~3 seconds
- Uses framer-motion for smooth enter/exit
- Positioned inline or as a floating indicator depending on context

**Create a `useRealtimeIndicator` hook** that:
- Exposes a `flash()` function and a `visible` boolean
- Calling `flash()` sets `visible = true`, then auto-resets to `false` after 3 seconds
- Debounces rapid consecutive updates (multiple tables changing at once) into a single flash

### Integration Points

**1. `AdminDashboard.tsx`** — Add the indicator near the top of the dashboard content area. Call `flash()` inside the realtime channel callbacks that trigger `loadData()` or stats refreshes (fraud alerts, transactions, profiles, agents, merchants, KYC, orders, referrals, treasury, support).

**2. Child components** (`AdminChargeConfig`, `AdminCommissionSetup`, `AdminChargebackHistory`, `AdminPermissions`, `AdminDisputeResolution`) — Each already has its own realtime subscription. Add the indicator component at the top of each, calling `flash()` inside their existing realtime callback.

### Files

- **New**: `src/hooks/use-realtime-indicator.ts` — hook with `flash()` / `visible` / debounce logic
- **New**: `src/components/admin/RealtimeUpdateIndicator.tsx` — small animated pill component
- **Edit**: `src/pages/AdminDashboard.tsx` — add indicator + call `flash()` in realtime callbacks
- **Edit**: 5 child components — add indicator + call `flash()` in their realtime callbacks

### Visual Design

A small pill at the top of the content area:
```
[● Data synced just now]
```
- Green dot with pulse animation, muted text, rounded-full badge style
- Fades in via framer-motion, auto-dismisses after 3s
- Non-blocking, no user interaction required

