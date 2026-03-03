

## Plan: KYC Verification Celebration + Real-time Banner Removal

### Current State
- `useKycStatus` already subscribes to real-time changes on `kyc_verifications` via Supabase Realtime — so the banner and FeatureGuard will automatically update when admin approves KYC. **No fix needed for real-time sync.**
- The confetti utility (`fireSuccessConfetti` in `src/lib/confetti.ts`) already exists.

### Changes

#### 1. Track previous KYC status to detect verification moment (`src/hooks/use-kyc-status.ts`)
- Add a `useRef` to track the previous status value.
- When status transitions from `"pending"` → `"verified"`, fire `fireSuccessConfetti()` and show a success toast ("Your identity has been verified! All features are now unlocked.").
- This ensures confetti only fires on the live transition, not on page load for already-verified users.

#### 2. Add celebratory haptic feedback (`src/hooks/use-kyc-status.ts`)
- Trigger the double-pulse haptic pattern (`navigator.vibrate([15, 40, 15])`) alongside the confetti, matching the app's existing celebration patterns.

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/use-kyc-status.ts` | Add previous-status ref, fire confetti + toast on `pending → verified` transition |

No other files need changes — the banner in `Index.tsx` and the gate in `FeatureGuard.tsx` already react to the `kycStatus` value, which updates in real-time.

