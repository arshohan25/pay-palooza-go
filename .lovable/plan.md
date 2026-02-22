

## Admin User Activity Monitor -- Full End-to-End Visibility

### Overview
Replace the current basic Transactions table with a comprehensive **Activity Monitor** that gives admins complete visibility into every user's activity across the system -- sender details, receiver details, transaction IDs, timestamps, fees, commissions, balances, and more.

### What Changes

**1. New component: `src/components/admin/AdminActivityMonitor.tsx`**

A dedicated activity monitoring component that replaces the current inline transactions table in the "Transactions" tab. Features:

- **Rich table columns**: Short ID, Type, Sender (name + phone, resolved from `profiles`), Receiver (name + phone), Amount, Fee, Commission, Balance After, Status, Date-Time
- **Expandable row detail**: Click any row to see a full detail panel with:
  - Complete Transaction ID (UUID) and Short ID
  - Sender name, phone, user ID
  - Recipient name, phone
  - Description, Reference
  - Fee breakdown (fee, commission, balance after)
  - Exact timestamp with full date-time
- **Filters**: Filter by transaction type (send, receive, cashout, etc.), status (completed, pending, failed, reversed), and date range
- **Search**: Search by phone number, name, transaction ID, or short ID
- **Sender profile resolution**: Joins `profiles` table using `user_id` to show sender name and phone alongside each transaction
- **Pagination**: Load more button for browsing beyond initial 100 records
- **Real-time updates**: Subscribe to new transaction inserts to keep the list live

**2. Update `src/pages/AdminDashboard.tsx`**
- Import and render `AdminActivityMonitor` in the "transactions" tab instead of the current inline table
- Remove the inline transactions table code

**3. Update `src/hooks/use-admin.ts`**
- Add `fetchAllTransactions()` helper that fetches transactions with higher limit (200) and all columns needed for the activity view

### Technical Details

- Sender info is resolved by fetching all unique `user_id` values from the transactions batch and querying `profiles` in bulk (same pattern used in `AdminFraudAlerts.tsx`)
- The expandable row uses `framer-motion` AnimatePresence for smooth open/close (existing pattern)
- Type filter uses a row of small buttons (existing pattern from fraud alerts status filter)
- Date-time displayed in full format: "Feb 22, 2026, 03:45 PM"
- No database schema changes required -- all data already exists in the `transactions` and `profiles` tables with admin RLS policies in place

