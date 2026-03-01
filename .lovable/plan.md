

## Admin Milestone Manual Control

Add clickable milestone toggles and a full reset button to each referral row in `AdminReferralManagement.tsx`, backed by a new secure database RPC.

### Database Migration

Create an `admin_toggle_referral_milestone` RPC (SECURITY DEFINER) that:
- Validates caller has admin role
- Accepts `p_referral_id`, `p_milestone` (1/2/3), `p_action` ('pay'/'reset')
- **Pay**: Sets the milestone flag to true, credits the referrer's balance (10/20/20), inserts a `referral_rewards` audit row, updates `total_rewarded` and status
- **Reset**: Sets the milestone flag to false, deducts from referrer balance (capped at available), deletes the corresponding `referral_rewards` row, decrements `total_rewarded`, recalculates status
- Uses `FOR UPDATE` row locking on both `referrals` and `profiles`

Also create an `admin_reset_all_milestones` RPC that resets all 3 milestones for a referral at once (deducting `total_rewarded` from referrer balance, deleting all reward rows, resetting flags to false and status to 'pending').

Both RPCs log to `audit_logs`.

### UI Changes (`AdminReferralManagement.tsx`)

1. Replace the static `MilestoneIcon` checkmarks with clickable buttons — green check (paid) or grey X (unpaid). Clicking toggles the milestone via the RPC.
2. Add a "Actions" column with a dropdown or button group containing "Reset All Milestones".
3. Add loading state per-row to prevent double-clicks.
4. Show toast on success/error via `sonner`.

### Files to Change
- **New**: Migration SQL with 2 RPCs (`admin_toggle_referral_milestone`, `admin_reset_all_milestones`)
- **Modify**: `src/components/admin/AdminReferralManagement.tsx` — clickable milestone cells + reset action

