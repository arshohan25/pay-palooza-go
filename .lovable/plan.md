## Goal

Today the dashboard shows a "Permission required" toast when a staff member taps a locked tile (Send Money, Cash Out, Add Bank, Bank Transfer, Settlement, Store Settings, etc.). There is no way for the staff to actually *ask* for it, and the owner has no inbox of pending requests. This plan closes that loop.

## What the user gets

**Staff side (manager/cashier):**
- Tap a locked Merchant Services tile → instead of just a toast, a small bottom sheet appears: "Request access to *Send Money*?" with an optional one-line note and a "Send request" button.
- If a request for that permission is already pending, the sheet shows "Request pending — owner has been notified" and disables the button.

**Owner side:**
- New section inside the existing **Staff** tab called **"Access Requests"** that lives above the staff list. It only renders when there are pending requests, with a small badge counter (so it disappears when the inbox is empty).
- A full **"Access Requests"** screen is also reachable from a new card in the Staff tab header ("View all requests · 3 pending"). This screen lists every request — pending, granted, denied — grouped by staff member.
- Each pending row shows: staff name + avatar, role badge, the permission being requested (human label like "Send Money"), the staff's note, and time ago. Two buttons: **Grant** (green) and **Deny** (outline). Granting flips the permission on `merchant_staff.permissions` and marks the request granted; denying just marks it denied with an optional reason.
- A secondary tab on the same screen, **"Granted permissions"**, lists every permission currently enabled per staff member with a quick **Revoke** button — this is the "revoke" half of the request. Revoking turns the permission off and notifies the staff member.

## Permissions in scope

The seven the user listed map to these existing keys in `src/lib/staffPermissions.ts`:

| User-facing name | Permission key |
|---|---|
| Payouts | `payouts` |
| Send Money | `payouts` (same gate) |
| Cash Out | `payouts` (same gate) |
| Add Bank | `store_settings` |
| Bank Transfer | `payouts` |
| Store Settings | `store_settings` |
| Settlements | `settlements` |

Send Money / Cash Out / Bank Transfer all gate behind `payouts` already (matches the dashboard logic we just shipped). The request screen will let staff request any of the seven names; the backend collapses them to the 3 underlying keys.

## Backend (Lovable Cloud)

Single new table `merchant_staff_permission_requests`:

```text
id                uuid pk
merchant_id       uuid  → merchants.id
staff_id          uuid  → merchant_staff.id
requested_by      uuid  (auth.uid of the staff)
permission_key    text  ('payouts' | 'store_settings' | 'settlements')
display_label     text  (the friendly name they tapped, e.g. 'Send Money')
note              text  (optional, max 200 chars)
status            text  ('pending' | 'granted' | 'denied' | 'cancelled')
decided_by        uuid  (owner's user id, null until decided)
decided_at        timestamptz
deny_reason       text
created_at        timestamptz default now()
unique (merchant_id, staff_id, permission_key) WHERE status = 'pending'
```

RLS policies (all use `has_role` / staff-access helpers, never client checks):
- Staff (`requested_by = auth.uid()`) can `select` and `insert` their own rows for their merchant.
- Owner (verified via existing `is_merchant_owner(merchant_id)` check used in other staff RLS) can `select` everything for their merchant and `update` status/decided_by/decided_at/deny_reason.
- Nobody can `delete` (audit trail).

A trigger on status change to `granted` calls a SECURITY DEFINER function that flips the matching key to `true` in `merchant_staff.permissions` for that staff row. Revoke from the UI is a direct update on `merchant_staff.permissions` (existing path) plus an insert of a `granted → revoked` audit row — handled in the edge function below to keep it atomic.

One edge function `merchant-staff-access-decision` (verify_jwt = false, validates token in code):
- Input: `{ request_id, action: 'grant' | 'deny' | 'revoke', reason? }`
- Verifies caller is the merchant owner.
- For `grant`: updates request → granted, trigger flips permission.
- For `deny`: updates request → denied with reason.
- For `revoke`: takes `{ staff_id, permission_key }` instead, flips permission off, inserts an audit row.
- Sends an in-app notification to the staff (uses the existing `notifications` insert pattern already used by `notify-staff-invite`).

## Frontend changes

New files:
- `src/components/merchant/StaffAccessRequestsPanel.tsx` — the inbox panel + full screen (single component, two views via internal tab state).
- `src/components/merchant/RequestAccessSheet.tsx` — the bottom sheet staff sees when tapping a locked tile.
- `src/hooks/use-staff-access-requests.ts` — fetch + realtime subscribe to `merchant_staff_permission_requests` for the current merchant; exposes `pending`, `history`, `submit`, `decide`, `revoke`.

Edits:
- `src/components/merchant/MerchantStaffTab.tsx` — render `<StaffAccessRequestsPanel inboxOnly />` above the stats grid when there are pending items; add a "View all requests" button that opens the full screen in a sheet.
- `src/pages/MerchantDashboard.tsx` (`MerchOverview`) — replace the current locked-tile toast with `setRequestSheet({ label, permission })` that opens `RequestAccessSheet`. The sheet calls `submit()` from the hook.

Visual style follows the existing glassmorphism / 19px radii / hidden scrollbars conventions already used in `MerchantStaffTab.tsx`. Pending count uses a small primary-tinted badge, granted uses emerald, denied uses muted.

## Realtime & UX

- The hook subscribes to `postgres_changes` filtered by `merchant_id`, so the owner sees new requests appear without refresh and the staff sees their request flip to granted/denied live (consistent with the project's zero-refresh policy).
- After a successful grant, the locked tile on the staff dashboard unlocks immediately because `useStaffAccess` already subscribes to its own permission updates.

## Out of scope

- No bulk approve. Each request is decided individually (small inbox, keeps audit clear).
- No email/SMS notifications for now — only in-app + push (uses existing notification fan-out).
- The other locked-tile permissions outside the seven listed (e.g. `analytics`, `inbox`) are not exposed to the request flow yet; the sheet only opens for the seven names above.
