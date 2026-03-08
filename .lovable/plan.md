

## Plan: Add Standalone API Request Management to Admin Dashboard

### Problem
Currently, API access requests can only be reviewed from within individual merchant detail sheets. There's no centralized view to see all pending requests across all merchants.

### Changes

**1. New Component: `src/components/admin/AdminApiRequests.tsx`**
A dedicated admin panel component that:
- Fetches all `merchant_api_requests` with merchant business name (join via `merchant_id`)
- Shows a summary card with counts: pending, approved, rejected
- Displays a filterable/searchable table of all requests
- Each row shows: merchant name, webhook URL, reason, status badge, date
- Pending requests have inline "Approve & Generate Key" and "Reject" buttons (with optional admin notes input)
- On approve: generates API key (same `epk_`/`eps_` pattern), updates request status, sends notification to merchant
- On reject: updates status with admin notes, sends notification
- Realtime subscription on `merchant_api_requests` table for live updates

**2. Update: `src/pages/AdminDashboard.tsx`**
- Import `AdminApiRequests` component
- Add a new nav item `{ id: "api-requests", label: "API Requests", icon: Key }` to `NAV_ITEMS` (after "API Hub")
- Render `<AdminApiRequests />` when `activeTab === "api-requests"`
- Add pending request count badge on the nav item (similar to support unread badge)

### No database changes needed
The `merchant_api_requests` table and RLS policies already exist with admin full access.

| File | Action |
|------|--------|
| `src/components/admin/AdminApiRequests.tsx` | Create — standalone request management component |
| `src/pages/AdminDashboard.tsx` | Add nav item + render component |

