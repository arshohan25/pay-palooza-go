## Goal
After a merchant submits "Request API access", show a confirmation banner on the Merchant Dashboard that reflects the current request status (pending / approved / denied) and updates live via Supabase realtime — independent of which tab the merchant is on.

## Changes

### 1. New component `src/components/MerchantApiAccessStatusBanner.tsx`
- Loads the merchant's most recent row from `merchant_api_access_requests` for the current `userId`.
- Subscribes to realtime `postgres_changes` on the same table filtered by `user_id`, so status flips reflect instantly.
- Renders a status banner with three states:
  - **Pending** (amber): "API access request submitted — our team is reviewing your request." Includes a "Follow up in Live Chat" link → `/account?openChat=1`. Not dismissable.
  - **Approved** (emerald): "API access approved — you can now generate API keys from the API tab." Dismissable.
  - **Denied** (destructive): Shows admin's `reviewer_note` if present, otherwise generic copy. Dismissable.
- Dismissal persists per `(userId, requestId, status)` in `localStorage` so a new submission re-shows the banner, and an approved banner stays gone after the user closes it.
- Pending state cannot be dismissed (so the merchant always sees their open request).

### 2. `src/pages/MerchantDashboard.tsx`
- Import the new banner.
- Render it at the top of the **overview** tab (line ~519, inside `<div className="px-4 py-4 pb-24">` before `<MerchOverview …/>`).
- Pass `visible={!isStaff}` so only merchant owners see it (staff never submit/manage API access).

## Technical Notes
- Reuses the existing `merchant_api_access_requests` table and RLS policies — no schema change.
- Realtime subscription is scoped per user via channel name `api-access-banner-${userId}` to avoid clashing with the gate's own channel.
- Dismissal is intentionally local (localStorage) — no DB writes, no extra columns. Status keys mean a "denied → re-requested → pending" sequence will re-surface naturally.
- Banner renders nothing if there is no request row, if `visible === false`, or if the user has dismissed the current terminal state.

## Files Touched
- `src/components/MerchantApiAccessStatusBanner.tsx` (new)
- `src/pages/MerchantDashboard.tsx`
