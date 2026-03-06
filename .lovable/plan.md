

## Plan: Add Real-Time Subscriptions to All Hooks Missing Them

### Current State

After reviewing the codebase, most core hooks already have real-time subscriptions:
- **Balance** — real-time via `setupBalanceRealtime()` on profiles table
- **Transactions** — real-time via `useTransactions` hook
- **Notifications** — real-time via `useNotifications` hook
- **KYC status** — real-time via `useKycStatus` hook
- **Feature locks** — real-time via `useFeatureLocks` hook
- **Global toggles** — real-time via `useGlobalToggles` hook
- **Chat messages/conversations** — real-time via `useChat` hook
- **Order status** — real-time via `useOrderNotifications` hook
- **Referrals** — real-time via `useReferrals` hook
- **Usage stats** — real-time via `useUsageStats` hook
- **Online presence** — real-time via Supabase Presence

### Hooks Missing Real-Time

Two hooks fetch data once and never subscribe to changes:

1. **`src/hooks/use-fee-config.ts`** — Fee configuration changes by admin are not pushed to users in real-time. Users must refresh to see updated fees.

2. **`src/hooks/use-saved-banks.ts`** — Saved bank accounts don't update in real-time (minor, since it's per-user data modified by the same user, but adding it ensures multi-device sync).

3. **`src/hooks/use-profile.ts`** — Profile data (name, avatar, phone) only updates via a `CustomEvent` from the edit flow. If an admin changes a user's profile or the user edits from another device, it won't reflect without a refresh.

### Implementation

#### 1. Add real-time to `src/hooks/use-fee-config.ts`
- Subscribe to `postgres_changes` on `fee_config` table (event: `*`)
- On any change, call `fetchRules()` to reload
- Clean up channel on unmount

#### 2. Add real-time to `src/hooks/use-saved-banks.ts`
- Subscribe to `postgres_changes` on `saved_bank_accounts` filtered by `user_id`
- Re-fetch on INSERT/DELETE events
- Clean up channel on unmount

#### 3. Add real-time to `src/hooks/use-profile.ts`
- Subscribe to `postgres_changes` on `profiles` filtered by `user_id`
- On UPDATE, re-fetch profile data
- Clean up channel on unmount

### Files to Modify
- `src/hooks/use-fee-config.ts`
- `src/hooks/use-saved-banks.ts`
- `src/hooks/use-profile.ts`

