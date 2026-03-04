

## Add Comprehensive Real-time Auto-update to Admin Panel

The admin dashboard already has a realtime channel (`admin-global-realtime`) listening to 8 tables, but several key tables are missing. After any admin action (KYC approval, order update, treasury disbursement, etc.), the panel doesn't auto-refresh those sections.

### Changes

**1. Database Migration — Enable realtime for `kyc_verifications`**

The `kyc_verifications` table is not in the realtime publication yet. Add it so KYC status changes broadcast to all admin sessions.

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.kyc_verifications;
```

**2. Expand the realtime channel in `src/pages/AdminDashboard.tsx`**

Add listeners for the missing tables to the existing `admin-global-realtime` channel:

- **`kyc_verifications`** (any change) → refresh `pendingKyc` stat count
- **`orders`** (any change) → no state held in dashboard directly, but refresh stats
- **`referrals`** / **`referral_rewards`** (any change) → refresh referral stats
- **`platform_treasury`** / **`treasury_ledger`** (any change) → refresh stats
- **`support_conversations`** (any change) → stats refresh
- **`notifications`** (INSERT) → lightweight, no action needed in main dashboard
- **`global_feature_toggles`** / **`payment_gateways`** (any change) → child components handle their own state, but a lightweight stats refresh ensures consistency

The expanded channel will add ~6 new `.on()` listeners covering all admin-actionable tables. Each triggers either a targeted data refetch or a full `loadData()` call depending on impact.

**3. Add `loadData()` calls after local admin actions that currently don't trigger them**

Review action handlers (KYC approve/reject, order status change, etc.) in child components. Most child components manage their own state, so we ensure the parent dashboard stats stay in sync by relying on the realtime channel rather than manual callbacks — this is the cleaner approach.

### Summary

- 1 small migration (enable realtime for `kyc_verifications`)
- Expand the realtime channel with ~6 additional table listeners
- No changes needed to child components — they already manage their own data; the realtime channel keeps parent stats in sync automatically

