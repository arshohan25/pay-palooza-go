

## Fund Request History View for Users

### What
Add a new "My Requests" page accessible from the Account page, showing all of a user's Add Money and Bank Transfer (withdrawal) requests with their current status (pending/approved/rejected), amounts, dates, and admin notes.

### How

**New component `src/components/FundRequestHistory.tsx`**:
- Full-page view with back button header
- Fetches `fund_requests` where `user_id = auth.uid()` ordered by `created_at desc`
- Real-time subscription for live status updates
- Each request card shows: type badge (Add Money / Withdraw), amount, source method, status badge (pending amber / approved green / rejected red), date, and admin note if rejected
- Empty state when no requests exist
- Tappable cards expand to show details (proof image, bank info, transaction ID)

**Edit `src/pages/AccountPage.tsx`**:
- Add a new `SubPage` value `"requests"`
- Add a `MenuRow` under "Insights & Limits" section: icon `ClipboardList` or `CreditCard`, label "My Fund Requests", sub "Track deposit & withdrawal status"
- Route to the new component when selected

**RLS**: Already covered — `fund_requests` table has a policy `Users can view own fund requests` (SELECT where `user_id = auth.uid()`). Need to verify this exists; if not, add it via migration.

### Files Changed
- `src/components/FundRequestHistory.tsx` (new)
- `src/pages/AccountPage.tsx` (add menu row + sub-page routing)
- Possible migration if user SELECT RLS policy is missing

