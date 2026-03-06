

## Plan: Enhance WebSocket Status with Auto-Reconnect and Tooltip

### 1. Update `src/hooks/use-realtime-status.ts`

Expand the hook to:
- Track `lastConnectedAt` timestamp and `reconnectAttempt` count
- On disconnect, start exponential backoff reconnection: remove old channel, create new one, subscribe again after delay (1s, 2s, 4s, 8s... capped at 30s)
- Reset attempt counter on successful reconnect
- Return an object: `{ status, lastConnectedAt, reconnectAttempt }`
- Clean up timeout on unmount

### 2. Update `src/pages/AdminDashboard.tsx`

- Import `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` from UI
- Destructure `{ status, lastConnectedAt, reconnectAttempt }` from the hook
- Wrap the existing status badge in a `Tooltip` that shows:
  - Channel: `admin-heartbeat`
  - Last connected: formatted timestamp (or "Never" if null)
  - Reconnect attempt count (when disconnected)

### Files
- `src/hooks/use-realtime-status.ts` (modify)
- `src/pages/AdminDashboard.tsx` (modify ~lines 16, 193, 562-578)

