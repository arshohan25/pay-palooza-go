

## Admin Referral & Device Management Panel

Add a new "Referrals" nav item to the admin dashboard with three sub-tabs: Referrals, Rewards, and Devices.

### New File: `src/components/admin/AdminReferralManagement.tsx`

A component with 3 sub-tabs:

**Referrals Tab**
- Fetch all rows from `referrals` table (admin RLS already allows full access)
- Show table: Referrer (join profiles for name/phone), Referee (join profiles), Code, Milestone progress (3 checkmarks), Total Rewarded, Status, Created date
- Filter by status (all/pending/active/completed)
- Search by referral code or phone

**Rewards Tab**  
- Fetch all from `referral_rewards` (admin has full access)
- Table: Referrer name/phone, Milestone type, Amount, Date
- Summary stats at top: total rewards paid, count by milestone type

**Devices Tab**
- Fetch all from `device_registrations` (currently RLS blocks all access — need migration to add admin SELECT policy)
- Table: Device fingerprint (truncated), User (join profiles for name/phone), Registered date
- Search by phone or fingerprint

### Database Migration
- Add admin SELECT policy on `device_registrations`: `has_role(auth.uid(), 'admin'::app_role)`

### Changes to `src/pages/AdminDashboard.tsx`
- Add `{ id: "referrals", label: "Referrals", icon: Gift }` to `NAV_ITEMS` (import `Gift` from lucide)
- Import and render `AdminReferralManagement` for the `referrals` tab
- Add referral stats to real-time channel (listen to `referrals` and `referral_rewards` table changes)

### Changes to `src/hooks/use-admin.ts`
- Add `fetchAllReferrals()` and `fetchAllDeviceRegistrations()` helper functions

