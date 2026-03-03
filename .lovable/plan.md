

## Plan: Browser Push Notification on KYC Rejection

### Current State
- The `kyc-notify` edge function **already** sends in-app notifications (inserts into `notifications` table), email (Resend), and SMS (Twilio) for **both** verified and rejected decisions.
- The `useNotifications` hook **already** picks up these in-app notifications via Supabase Realtime.
- The `useKycStatus` hook **already** fires confetti + toast on `pending → verified` transitions.
- **Missing**: Browser push notification (via the `Notification` API) and a toast alert when KYC is **rejected**, so users are notified even when not actively viewing the home screen.

### Changes

#### 1. Add rejection detection to `useKycStatus` (`src/hooks/use-kyc-status.ts`)

Extend the existing `pending → verified` celebration logic to also handle `pending → rejected`:
- Show a destructive toast with the rejection reason
- Fire a browser `Notification` (requesting permission if needed) with the rejection reason
- Trigger error haptic feedback

#### 2. Add browser notification permission request (`src/hooks/use-kyc-status.ts`)

Request `Notification.permission` on mount (same pattern as `useSupportNotifications`), and fire a `new Notification(...)` on status transitions for both verified and rejected — so users see the alert even if the app tab is in the background.

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/use-kyc-status.ts` | Add rejected transition detection with toast, browser Notification, and haptics |

No database or edge function changes needed — the backend already handles rejection notifications across all channels.

