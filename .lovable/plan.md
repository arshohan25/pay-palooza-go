

## Plan: Add Persistent WebSocket Connection Status Indicator to Admin Dashboard Header

### What

A small indicator in the admin dashboard header bar (next to the refresh and activity feed buttons) that shows whether the real-time WebSocket connection is active (green dot + "Live") or disconnected (red dot + "Offline"). It updates automatically based on the Supabase channel subscription status.

### How

**1. Create `src/hooks/use-realtime-status.ts`**

A hook that subscribes to the Supabase channel status events (`SUBSCRIBED`, `CLOSED`, `CHANNEL_ERROR`, `TIMED_OUT`) from the existing `admin-global-realtime` channel pattern. It will:
- Track connection state: `"connected" | "connecting" | "disconnected"`
- Create a dedicated lightweight channel (e.g. `admin-heartbeat`) that listens to its own subscription status via `.subscribe((status) => ...)` callback
- Clean up on unmount

**2. Update `src/pages/AdminDashboard.tsx`**

- Import and use the new hook
- Render a small status badge in the header (line ~541, alongside the existing action buttons):
  - Connected: green pulsing dot + "Live" text
  - Connecting: amber dot + "Connecting…"
  - Disconnected: red dot + "Offline"

### Files
- `src/hooks/use-realtime-status.ts` (new)
- `src/pages/AdminDashboard.tsx` (modify header area ~line 541)

