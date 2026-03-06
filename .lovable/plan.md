
Issue restatement:
The app still shows “Please complete KYC verification to use this feature.” and closes transaction flows, even for users already marked KYC-exempt.

What I found:
1) The user profile for 01680693484 is correctly set to `kyc_exempt = true` in backend.
2) `transactions` table already has a valid INSERT RLS policy with `WITH CHECK (auth.uid() = user_id)`, so this is not a transaction-policy issue.
3) That exact toast text exists only in `FeatureGuard.tsx`, so blocking is happening in UI guard logic.
4) Root cause is an auth/KYC race in `useKycStatus`:
   - `useKycStatus` uses `useAuth()`, but if `user` is temporarily null during auth bootstrap, it immediately sets status to `"none"` and `loading=false`.
   - `FeatureGuard` then treats that as a real non-KYC user and auto-closes the flow with that toast.
   - This can happen repeatedly when guarded flows mount.

Implementation plan:
1) Fix `src/hooks/use-kyc-status.ts` (primary fix)
   - Use `const { user, loading: authLoading } = useAuth()`.
   - Do not set KYC status to `"none"` while `authLoading` is true.
   - Keep KYC hook in loading state until auth is fully resolved.
   - Only set `"none"` when auth is resolved and there is truly no logged-in user.
   - Set loading true at start of authenticated fetch cycle.
   - Harden profile read with `.limit(1).maybeSingle()` before evaluating `kyc_exempt`.

2) Harden `src/components/FeatureGuard.tsx`
   - Continue blocking decisions only after KYC hook is fully resolved.
   - Avoid triggering auto-close/toast during transient bootstrap states.
   - Keep existing business logic (global toggle/feature lock/KYC decision order) unchanged.

3) Verification checklist (end-to-end)
   - Admin: toggle KYC Exempt ON for target user.
   - User (fresh reload): open Send Money, Cash Out, Payment, Pay Bill, Recharge.
   - Confirm flow stays open (no KYC toast).
   - Perform an actual transaction successfully.
   - Admin: toggle exemption OFF and confirm KYC toast/blocking returns.

Technical details:
- Files to update:
  - `src/hooks/use-kyc-status.ts`
  - `src/components/FeatureGuard.tsx`
- Database migration: not required for this fix.
- Security posture remains unchanged: non-exempt users are still blocked; only exemption behavior becomes reliable.
