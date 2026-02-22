

## Real-Time Fraud Alert Notifications for Admins

### What This Does
When a new fraud alert is created in the system, any admin currently on the Admin Dashboard will instantly receive a toast notification with the alert details -- no need to manually refresh.

### How It Works
- Subscribe to real-time `INSERT` events on the `fraud_alerts` table when the Admin Dashboard mounts
- Display a sonner toast with the alert severity, rule triggered, and a prompt to check the Fraud tab
- Auto-refresh the fraud alerts list when a new alert arrives
- Clean up the subscription when leaving the dashboard

### Technical Details

**File: `src/pages/AdminDashboard.tsx`**

1. Add a Supabase Realtime channel subscription inside a `useEffect` that:
   - Listens for `postgres_changes` with `event: 'INSERT'` on `public.fraud_alerts`
   - On each new alert, fires a `toast.warning()` or `toast.error()` (based on severity) showing the rule name and severity
   - Calls the existing `loadData()` / stats refresh to update the open alerts count in the stat cards
2. Unsubscribe from the channel on component unmount

**File: `src/components/admin/AdminFraudAlerts.tsx`**

1. Add a Realtime subscription for `INSERT` events on `fraud_alerts`
2. When a new alert arrives, prepend it to the local `alerts` state (avoiding a full refetch) and update the profiles map if the user is new
3. Play the existing two-tone chime sound (reuse pattern from support notifications) for critical/high severity alerts
4. Clean up subscription on unmount

### No Database Changes Required
Realtime is already enabled for `fraud_alerts` and RLS policies already allow admin/compliance users to see all alerts.

