

## Add Referral Stats to Admin Overview Cards

### Changes

**`src/pages/AdminDashboard.tsx`**
- Expand `Stats` interface with `totalReferrals` and `totalRewardsPaid`
- In `loadData`, add two parallel queries: count from `referrals` table and sum of `amount` from `referral_rewards` table
- Add two new `StatCard` entries to the overview grid: "Referrals" (Gift icon, count) and "Rewards Paid" (Award icon, total ৳ amount)
- Update grid from `lg:grid-cols-6` to `lg:grid-cols-4` (8 cards now, 4 per row looks better)

**`src/hooks/use-admin.ts`**
- Update `fetchAdminStats` to also query referral count and reward sum in the existing `Promise.all`

**`src/pages/AdminDashboard.tsx` — StatCard**
- Minor tweak: support string values (for formatted currency like "৳1,250") alongside numbers, or format inline

No database changes needed — admin already has full SELECT access on both `referrals` and `referral_rewards`.

