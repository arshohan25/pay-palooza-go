

## Plan: KYC Rejection Flow with Reason Banner and Resubmission

### Problem
When KYC is rejected, the `KycFlow` component doesn't recognize the "rejected" status — it only checks for "verified" and "pending" (line 889), so rejected users fall through to the fresh KYC intro screen without seeing why they were rejected. The Index.tsx banner already shows "KYC Rejected — Resubmit" but lacks the actual rejection reason.

### Changes

#### 1. Update KycFlow status check to handle "rejected" (`src/components/KycFlow.tsx`)

**Line 889**: Also set `kycStatus` when status is `"rejected"`. Fetch `reviewer_notes` alongside `status`:
```typescript
.select("status, reviewer_notes")
```
Store the reviewer_notes in a new state variable `rejectionReason`.

**Lines 1229–1230**: Add a new rejected status screen between the "pending" block and the main form. This screen will:
- Show a red/destructive icon (XCircle)
- Display the rejection reason from `reviewer_notes`
- Show a "Resubmit KYC" button that resets `kycStatus` to `null` so the user can go through the flow again

#### 2. Show rejection reason in Index.tsx banner (`src/pages/Index.tsx`)

Update `useKycStatus` hook to also return the `reviewer_notes` when status is rejected. Then display the reason in the banner subtitle instead of the generic "Please resubmit your verification documents".

#### 3. Update `useKycStatus` hook to return rejection reason (`src/hooks/use-kyc-status.ts`)

Add `rejectionReason` to the hook's return value by fetching `reviewer_notes` from the query.

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/use-kyc-status.ts` | Fetch and return `reviewer_notes` as `rejectionReason` |
| `src/components/KycFlow.tsx` | Handle rejected status, show reason + resubmit button |
| `src/pages/Index.tsx` | Show rejection reason in the banner |

### No database changes needed.

