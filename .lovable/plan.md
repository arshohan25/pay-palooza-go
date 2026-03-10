
Goal: stop transaction flows from jumping back to the first input step after successful payment/recharge/send, so users stay on the success receipt screen until they choose Home or Share/Download.

What I found
1) FeatureGuard is unmounting active flow components during background KYC refresh:
- `FeatureGuard` returns `null` whenever `kycLoading` is true.
- `useKycStatus` re-runs `fetchStatus()` on every `profiles` update.
- Transactions update `profiles` (balance), which triggers KYC refetch, temporarily setting `loading=true`, unmounting the flow, and remounting it at step 1.

2) There is still unstable AnimatePresence behavior in transaction stack:
- Console shows Framer `PopChild`/ref warnings around flow overlays.
- `Index.tsx` flow overlay `AnimatePresence` has no explicit mode.
- `MobileRechargeFlow` and `PayBillFlow` still use `mode="popLayout"` (these were not included in the previous fix pass).

Implementation plan
1) Stabilize KYC/FeatureGuard so active flows are never unmounted by background refresh
- File: `src/hooks/use-kyc-status.ts`
  - Make KYC loading “blocking” only for initial auth resolution, not every background refetch.
  - Restrict profile realtime-triggered KYC refetch to only when KYC-relevant fields change (e.g. `kyc_exempt`), not balance updates.
- File: `src/components/FeatureGuard.tsx`
  - Prevent returning `null` once the guard has already resolved and user is allowed.
  - Keep children mounted during non-critical background revalidation.

2) Make flow transitions deterministic and ref-safe
- File: `src/pages/Index.tsx`
  - Set flow overlay `AnimatePresence` to explicit `mode="wait"` (and `initial={false}`) so wrapped flow components are not pop-layout measured/remounted.
- File: `src/components/MobileRechargeFlow.tsx`
  - Change step container `AnimatePresence` from `mode="popLayout"` to `mode="wait"`.
- File: `src/components/PayBillFlow.tsx`
  - Change step container `AnimatePresence` from `mode="popLayout"` to `mode="wait"`.

3) Eliminate remaining ref-warning source in slider path (if still present after step 2)
- File: `src/components/SlideToConfirm.tsx`
  - If warning persists, wrap exported component with `forwardRef` and attach to root track div for Framer compatibility in presence transitions.

Validation plan
- Execute one successful transaction in each flow:
  - Send Money, Payment, Cash Out, Mobile Recharge, Pay Bill, Bank Transfer.
- For each flow verify:
  - Success screen stays visible for at least 10–15 seconds.
  - Share/Download receipt can open and close without returning to step 1.
  - Only “Back to Home/Done” closes flow.
- Confirm console no longer shows:
  - “Function components cannot be given refs… Check render method of SlideToConfirm.”
  - No unexpected remount/reset behavior.
