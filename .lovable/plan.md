

## Plan: KYC-Gated Actions + Account Creation Verification

### Overview
Two changes: (1) Create a KYC status hook and use it to block all financial actions until KYC is verified, showing a prompt to complete KYC instead. (2) Test that name/phone appear correctly after signup.

---

### 1. Create `src/hooks/use-kyc-status.ts`

A new hook that fetches the current user's KYC status from `kyc_verifications` and caches it:

```typescript
export function useKycStatus() {
  // Returns { status: "none" | "pending" | "verified" | "rejected", loading: boolean }
  // Queries kyc_verifications table for current user
}
```

### 2. Update `FeatureGuard` to enforce KYC

Modify `src/components/FeatureGuard.tsx` to:
- Import `useKycStatus`
- If KYC status is not `"verified"`, block the action with a toast: "Please complete KYC verification first"
- Auto-close the flow (same pattern as existing lock/disable logic)

This single change gates **all** financial flows (Send Money, Cash Out, Payment, Recharge, Pay Bill, Add Money, Shop) since they all use `FeatureGuard`.

### 3. Add KYC prompt banner on home page

In `src/pages/Index.tsx`, after the user is authenticated and KYC is not verified:
- Show a persistent banner/card below the balance card prompting the user to complete KYC
- Tapping the banner opens `KycFlow`
- Banner text: "Complete KYC to unlock all features" with a shield icon

### 4. No database changes needed

The `kyc_verifications` table already exists with proper status tracking.

---

### Files to Create/Modify

| File | Change |
|------|--------|
| `src/hooks/use-kyc-status.ts` | New hook — fetch KYC status for current user |
| `src/components/FeatureGuard.tsx` | Add KYC verification check before allowing actions |
| `src/pages/Index.tsx` | Add KYC prompt banner when KYC is incomplete |

