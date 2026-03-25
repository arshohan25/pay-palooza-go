

## Complete Referral Flow End-to-End

### Current State
- **Database**: `referrals`, `referral_rewards` tables exist with RLS policies
- **Triggers**: `check_referral_milestones` fires automatically on transaction insert and KYC verification
- **UI**: ReferPage shows referral dashboard; AuthPage has `referralCodeInput` state but **no input field** to enter it
- **Auth**: `signUp()` in `lib/auth.ts` accepts referral code and creates the referral row

### What's Missing

1. **No referral code input field** during registration — the state exists but no UI renders it
2. **No referral code validation** — user can enter any text; should validate format and existence
3. **No notifications to referrer** when milestones are hit
4. **No deep-link / URL-based referral** — sharing a link should pre-fill the code on signup

### Plan

**1. Add Referral Code Input to Registration (AuthPage.tsx)**
- On the `register_phone` screen, add a collapsible "Have a referral code?" section below the phone input
- Tapping it reveals a text input bound to `referralCodeInput`
- Validate format (`EZP-XXXX-XXXX`) on blur; show error if invalid
- Also read `?ref=CODE` from URL params and pre-fill the input automatically

**2. Validate Referral Code Before Signup (lib/auth.ts)**
- In `signUp()`, before inserting the referral row, verify the code exists and belongs to a different user
- Already partially done — just need to surface errors to the UI if the code is invalid

**3. Add Referrer Notifications on Milestone Payouts (DB Migration)**
- Update `check_referral_milestones` function to insert a notification row for the referrer when each milestone is paid:
  - Milestone 1: "Your referral earned ৳10! [referee] completed KYC"
  - Milestone 2: "Your referral earned ৳20! [referee] made their first transaction"  
  - Milestone 3: "Your referral earned ৳20! [referee] completed 5 transactions"

**4. Support Deep-Link Referrals (AuthPage.tsx + ReferPage.tsx)**
- Read `?ref=` query param from URL in AuthPage and auto-fill `referralCodeInput`
- In ReferPage share actions, include the deep link: `https://pay-palooza-go.lovable.app/?ref=CODE`

### Files to Change

| File | Change |
|------|--------|
| `src/pages/AuthPage.tsx` | Add referral code input field on register_phone screen; read `?ref=` URL param |
| `src/pages/ReferPage.tsx` | Update share text to include deep link URL |
| `src/lib/auth.ts` | Add referral code format validation before lookup |
| DB Migration | Update `check_referral_milestones` to insert notification rows for referrer on each milestone payout |

### Technical Details

**Referral Input UI** (register_phone screen):
```text
┌─────────────────────────┐
│ 📱 Enter mobile number  │
│ [01XXXXXXXXX          ] │
│                         │
│ 🎁 Have a referral code?│  ← collapsible
│ [EZP-XXXX-XXXX       ] │  ← shown when expanded
│                         │
│ [  Send OTP  →        ] │
└─────────────────────────┘
```

**Deep link format**: `https://pay-palooza-go.lovable.app/?ref=EZP-XXXX-XXXX`

**Notification insert** (inside `check_referral_milestones`):
```sql
INSERT INTO notifications (user_id, title, body, category, metadata)
VALUES (v_referral.referrer_id, '🎉 Referral Reward: ৳10', 
  'Your referred friend completed KYC verification!', 'referral',
  jsonb_build_object('referral_id', v_referral.id, 'milestone', 'kyc_verified', 'amount', 10));
```

