

## Remove Fee Labels from Merchant Quick Action Cards

### Problem
The merchant dashboard quick action cards (Send Money, Cash Out, Add Bank, Settlement) show fee details in a small subtitle line. User wants these removed from the card view — fees are already shown in the Analytics tab's fee schedule section.

### Changes

**File: `src/pages/MerchantDashboard.tsx`**

1. **Remove `desc` from quick actions** (lines 683–687): Remove the `desc` property from all 4 action objects.

2. **Remove `desc` rendering** (line 706): Remove the `<span>` that displays `a.desc`.

3. **Remove unused `getMerchFeeLabel`** import on line 681 (the first one in the Home tab — the Analytics tab still uses its own instance on line 806, so that stays).

Three small edits in one file.

