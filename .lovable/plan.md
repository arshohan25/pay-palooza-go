
Fix the issue as an interaction problem, not just a layout problem.

What I found:
- In `src/components/admin/AdminApiKeys.tsx`, the revoke/reactivate button does call `toggleKey`, but that function:
  - does not check `error` from the update
  - does not refresh local state after success
  - depends on realtime to visually update the row
- In the captured network activity, I only see `GET` requests for `merchant_api_keys` and no update request when the button was supposedly clicked, which suggests the action is effectively behaving like a no-op from the user’s perspective.
- The “Generate Key” action in `src/components/admin/AdminApiRequests.tsx` is also wired through `window.__openGenerateApiKey`, which is brittle and can silently fail if the child hasn’t registered the callback yet.

Implementation plan:
1. Fix API key row actions in `src/components/admin/AdminApiKeys.tsx`
- Wrap `toggleKey`, `handleRotate`, and `savePermissions` in proper `try/catch`
- Read and handle Supabase `error` explicitly
- Show failure toast on mutation errors instead of always showing success
- After a successful mutation, immediately update local `keys` state or call `fetchKeys()` so the button visibly works without relying on realtime

2. Make the actions reliably clickable
- Keep the action cell fully visible with fixed-width/non-shrinking action controls
- Ensure the action button group has `shrink-0` / nowrap behavior so the clickable area is not compressed or clipped
- If needed, make the Actions column right-aligned and width-stable so “Reactivate” is fully tappable/clickable

3. Remove the brittle window-based Generate Key trigger
- Replace `window.__openGenerateApiKey` with a normal React prop/callback flow between `AdminApiRequests` and `AdminApiKeys`
- Keep dialog state in a predictable component path so the button always opens the modal

4. Preserve the responsive fixes while correcting behavior
- Keep the scrollable desktop table and wrapping summary cards
- Re-check that table overflow changes do not interfere with pointer targets

Files to update:
- `src/components/admin/AdminApiKeys.tsx`
- `src/components/admin/AdminApiRequests.tsx`
- possibly small follow-up in `src/pages/AdminDashboard.tsx` only if parent overflow is still affecting click targets

Expected result:
- Revoke / Reactivate actually changes the row immediately
- Rotate and permission-save actions show real success/error states
- Generate Key always opens
- The API Access Management buttons feel responsive instead of appearing broken
