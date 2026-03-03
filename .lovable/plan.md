

## Plan: Add Notification Sound for KYC Status Changes

### Approach
Follow the existing Web Audio API pattern (used in `useSupportNotifications` and `useOrderNotifications`) to synthesize chimes directly — no external audio files needed.

### Sound Design
- **Verified**: Ascending 3-note chime (660Hz → 880Hz → 1100Hz, ~0.4s) — celebratory, matching the confetti moment
- **Rejected**: Descending 2-note tone (440Hz → 330Hz, ~0.3s) — gentle alert, not harsh

### Changes

#### `src/hooks/use-kyc-status.ts`
- Add a `playKycChime(type: "success" | "error")` helper function using `AudioContext` (same pattern as `playOrderChime` in `use-order-notifications.ts`)
- Call `playKycChime("success")` in the `pending → verified` block alongside confetti
- Call `playKycChime("error")` in the `pending → rejected` block alongside the error toast

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/use-kyc-status.ts` | Add `playKycChime` function, call it on status transitions |

No other files affected.

