

## Fix: Infinite Render Loop Crashing API Keys Buttons

### Root Cause
The console shows `Maximum update depth exceeded` originating from `GenerateKeyTrigger`. The loop:
1. `AdminApiRequests` passes `onGenerateRef={(fn) => setOpenGenerateKey(() => fn)}` -- this creates a new arrow function every render
2. `AdminApiKeys` passes `onGenerateRef` + `onOpen` to `GenerateKeyTrigger`
3. `GenerateKeyTrigger.useEffect` depends on `[onOpen, onGenerateRef]` -- since `onGenerateRef` is a new function each render, the effect fires
4. The effect calls `onGenerateRef(onOpen)` which calls `setOpenGenerateKey(() => fn)` in the parent
5. Parent re-renders -> new `onGenerateRef` -> repeat infinitely

This infinite loop exhausts React's update budget and makes the entire component tree unresponsive -- no button works.

### Fix

**File: `src/components/admin/AdminApiKeys.tsx`**
- Remove the `GenerateKeyTrigger` component entirely
- Use a `useEffect` directly in `AdminApiKeys` that calls `onGenerateRef` with a stable ref to `openGenerate`, using `useRef` to avoid dependency issues

**File: `src/components/admin/AdminApiRequests.tsx`**
- Stabilize the `onGenerateRef` callback using `useCallback` so it doesn't create a new function reference each render

Additionally, add a **Delete button** (only for revoked keys) with confirmation dialog, since the user also wants delete functionality. The RLS policy already allows admin deletes.

### Changes Summary

1. **Fix infinite loop** - Replace `GenerateKeyTrigger` with a stable `useEffect` + `useRef` pattern in `AdminApiKeys`, and wrap `onGenerateRef` in `useCallback` in `AdminApiRequests`
2. **Add Delete button** - Show a "Delete" button next to "Reactivate" for revoked keys only, with an `AlertDialog` confirmation before calling `supabase.from("merchant_api_keys").delete().eq("id", id)`

