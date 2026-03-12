## Link User Tickets to Admin Support Dashboard

### Current State

User tickets (from MyTicketsPage) already write to the `support_conversations` table, and AdminSupportDashboard already queries all rows from that table. So tickets **do appear** in the admin view — but the admin UI doesn't show ticket subjects, doesn't have a "Resolve" action (only "Close"), and doesn't display ratings. The experience feels disconnected.

### Changes

`**src/components/admin/AdminSupportDashboard.tsx**` — Enhance the admin view to fully support ticket workflows:

1. **Show ticket subject** in the conversation list (below user name, before last message preview)
2. **Add status filter tabs** — All / Open / Resolved / Closed — so admins can triage
3. **Add "Resolve" button** next to "Close" in the chat header (sets status to `resolved`)
4. **Add "Reopen" button** for closed/resolved tickets so admins can reopen if needed
5. **Show ticket rating** (star display) in conversation list for resolved tickets that have been rated
6. **Show subject in chat header** alongside user name/phone
7. **Allow replying to resolved tickets** (only closed tickets block replies — resolved stays interactive until explicitly closed)
8. Suppot email should be receive/reply from on this dashboard too

### No database changes needed

All columns (`subject`, `status`, `rating`) already exist on `support_conversations`. This is purely a UI enhancement in AdminSupportDashboard.

### Summary

- 1 file edited: `src/components/admin/AdminSupportDashboard.tsx`
- Admin sees ticket subjects, can filter by status, resolve/reopen/close tickets, and view user ratings
- Real-time sync already in place — no new subscriptions needed