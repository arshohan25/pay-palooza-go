## Referral System with Real-time Rewards + Device-Level Account Restriction

### Overview

Replace the static/mock referral page with a fully functional database-backed referral system featuring milestone-based rewards (৳10 → ৳20 → ৳20 = ৳50 total), and enforce one-account-per-device to prevent abuse.

### Reward Milestones

```text
Milestone 1: Referee completes KYC verification     → Referrer gets ৳10
Milestone 2: Referee does 1 txn (min ৳101)           → Referrer gets ৳20  
Milestone 3: Referee does 5 txns (min ৳500 total)   → Referrer gets ৳20
                                                Total: ৳50 per referral
```

### Database Changes (3 new tables + profile column)

**1. `referrals` table**

- `id`, `referrer_id` (uuid), `referee_id` (uuid), `referral_code` (text)
- `milestone_1_paid` (bool, default false) — KYC verified
- `milestone_2_paid` (bool, default false) — 1st txn ≥ ৳101
- `milestone_3_paid` (bool, default false) — 5 txns ≥ ৳500 total
- `total_rewarded` (numeric, default 0)
- `status` (text: pending/active/completed/failed)
- `created_at`, `updated_at`
- RLS: users can view own referrals (as referrer or referee), admins can manage all

**2. `referral_rewards` table** (audit trail of each payout)

- `id`, `referral_id`, `referrer_id`, `milestone` (text: kyc_verified/first_txn/five_txns)
- `amount` (numeric), `created_at`
- RLS: users can view own rewards, admins can manage all

**3. `device_registrations` table** (one-account-per-device enforcement)

- `id`, `device_fingerprint` (text, unique), `user_id` (uuid), `created_at`
- RLS: no direct access (managed by edge function)

**4. Add `referral_code` column to `profiles**`

- Auto-generated unique code on signup (format: `EZP-XXXX-XXXX`)

### Database Functions (RPCs)

`**check_referral_milestones(p_referee_id)**` — SECURITY DEFINER

- Called after KYC verification and after each transaction
- Checks each milestone condition, pays reward via balance credit + inserts referral_rewards record
- Atomically updates referrer balance and referral milestone flags
- Uses row-level locking to prevent double-pay

`**generate_referral_code()**` — generates unique EZP-XXXX-XXXX codes

### Edge Function: `validate-device`

- Accepts a device fingerprint during registration
- Checks `device_registrations` table — if fingerprint exists with another user, blocks signup
- On successful registration, records the fingerprint

### Device Fingerprinting (Client-side)

- Generate a deterministic fingerprint using: `canvas fingerprint + screen resolution + timezone + language + platform`
- Store in `localStorage` as `mfs_device_fp`
- Send during registration to the `validate-device` edge function
- No external library needed — use native Canvas API hashing

### Auth Flow Changes (`AuthPage.tsx`)

1. Add optional "Referral Code" input field on registration phone step
2. During `handleRegisterName`, call `validate-device` edge function first
3. If device already registered → show error "This device already has an account"
4. On successful signup → store referral link in `referrals` table, record device fingerprint

### Referral Page Rewrite (`ReferPage.tsx`)

- Fetch user's `referral_code` from profiles
- Fetch referrals list from `referrals` table with real-time subscription
- Show actual milestone progress per referral (3-step visual: KYC → 1st Txn → 5 Txns)
- Real stats: total earned, referred count, completed count from DB
- Share text uses actual user code

### Milestone Trigger Points

1. **KYC trigger**: Add call to `check_referral_milestones` in KYC admin approval flow (when status changes to 'verified')
2. **Transaction trigger**: Create a DB trigger on `transactions` INSERT that calls milestone check for the user

### Real-time Updates

- Enable realtime on `referrals` and `referral_rewards` tables
- ReferPage subscribes to changes for instant reward notifications

### Files to Create/Modify

- **New**: Migration SQL (tables + RPCs + triggers)
- **New**: `supabase/functions/validate-device/index.ts`
- **New**: `src/lib/deviceFingerprint.ts` — canvas-based fingerprint generator
- **New**: `src/hooks/use-referrals.ts` — fetch/subscribe referral data
- **Modify**: `src/pages/AuthPage.tsx` — referral code input + device validation
- **Modify**: `src/lib/auth.ts` — pass referral code to signup, store in referrals table
- **Modify**: `src/pages/ReferPage.tsx` — full rewrite with live DB data
- **Modify**: `src/lib/i18n.tsx` — update referral-related translations

### Security Considerations

- All reward payouts via SECURITY DEFINER RPCs with row locking
- Device fingerprint validated server-side (edge function with service_role)
- Self-referral prevention (referrer_id ≠ referee_id)
- Duplicate referral prevention (unique constraint on referee_id)
- Rate limiting on device validation endpoint