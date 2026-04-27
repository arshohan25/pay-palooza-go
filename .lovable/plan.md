## Goal
Hide the **API Integration** tab from merchants by default. Merchants must request access through **Live Chat** with admin/support. Once admin enables it (per merchant), the tab appears in the dashboard, and only then can the merchant request actual API keys (the existing flow shown in the screenshot).

## How it works (two-stage unlock)

**Stage 1 — Tab visibility (NEW)**: per-merchant access flag controlled by admin
**Stage 2 — API key issuance (already exists)**: `merchant_api_requests` → admin approves → keys generated

## Changes

### 1. Database migration
- New table `merchant_api_access` (or reuse `user_feature_overrides` with feature_key = `merchant_api`):
  - Use existing `user_feature_overrides` system — set `visibility = 'visible'` per merchant user_id to unlock; absent row = locked.
- Update the global toggle default for `merchant_api` so it's **disabled by default** for everyone, then per-user overrides flip it on.
- RLS: merchants can read their own row; only admins can insert/update.

### 2. Merchant Dashboard (`src/pages/MerchantDashboard.tsx`)
- The existing `isDisabled('merchant_api')` filter (line 184) already removes the tab when the toggle is off. With the global default flipped to OFF, the tab disappears for everyone unless an override is present.
- Confirm `useGlobalToggles` merges per-user overrides correctly (it already queries `user_feature_overrides`).

### 3. New "Request API Access" entry point
Since the tab itself is hidden, merchants need a discoverable path to ask. Add a small **"API Integration — Locked"** card in the **menu drawer / More section** (always visible to merchants) that:
- Shows a 🔒 badge + short description.
- CTA button **"Request via Live Chat"** → opens the existing SupportChat with a pre-filled message: *"I'd like to request API Integration access for my merchant account."*
- If a request is already in flight (track via a new `merchant_api_access_requests` row OR a flag on the chat message), show **"Request pending review"**.
- Once admin grants access → card disappears, real **API Integration** tab appears (real-time via existing `user_feature_overrides` postgres_changes subscription).

### 4. Admin side
- In **Live Chat (AdminChatMonitor)**, add a quick action button on merchant conversations: **"Grant API Access"** → inserts/updates `user_feature_overrides` row with `feature_key='merchant_api'`, `visibility='visible'` for that merchant's user_id, and replies in chat with confirmation.
- Also surface in **AdminUserFeatureAccess** (already supports it generically — no change needed beyond ensuring `merchant_api` appears in the feature key list).

### 5. Existing API request/key flow (no change)
The screenshot's *"YOUR REQUESTS / YOUR API CREDENTIALS"* UI in `MerchantApiTab.tsx` stays exactly as-is. It only becomes reachable after Stage 1 unlock.

## Files touched
- `supabase/migrations/<new>.sql` — flip default for `merchant_api` global toggle to disabled; ensure RLS on overrides.
- `src/pages/MerchantDashboard.tsx` — add the always-visible "Locked" card when `merchant_api` is disabled for the user.
- `src/components/SupportChat.tsx` — accept optional `prefilledMessage` prop.
- `src/components/admin/AdminChatMonitor.tsx` — add "Grant API Access" quick action.
- (Optional) small `useMerchantApiAccess` hook wrapping the existing toggles read for clarity.

## Result
- Merchants see no API tab by default.
- They request access through Live Chat (one click from a locked card).
- Admin grants from chat or User Feature Access panel.
- Tab appears in real-time, and merchant can then request API keys as before.
