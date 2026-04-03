# Add 20-Second Minimum to Session Timeout Options

## What Changes

### 1. Admin UI — Timeout dropdown options (AdminSystemSettings.tsx)

Add lower time options starting from 20 seconds before the existing 5-minute option:

- 20 seconds, 30 seconds, 45 seconds, 1 minute, 2 minutes, 3 minutes (new)
- 5 minutes, 10 minutes, ... 8 hours (existing)

The stored value will use fractional minutes (e.g., `"0.33"` for 20s, `"0.5"` for 30s).

### 2. Session timeout hooks — Support sub-minute values

Both `use-session-timeout.ts` (team) and `use-user-session-timeout.ts` (regular users) parse the config as integer minutes via `parseInt`. Update both to use `parseFloat` so fractional minute values (like `0.33`) convert correctly to milliseconds.

## Files Changed

- `src/components/admin/AdminSystemSettings.tsx` — Add 20s, 30s, 45s, 1m, 2m, 3m options to the Select dropdown
- `src/hooks/use-session-timeout.ts` — Change `parseInt` to `parseFloat`
- `src/hooks/use-user-session-timeout.ts` — Change `parseInt` to `parseFloat`