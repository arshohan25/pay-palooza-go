## Remove Admin Limitations on KYC Approval Not users

The screenshot shows an error "Cannot approve: Another account is already verified with this NID" — caused by two database-level constraints that block admin KYC approvals:

1. **Unique NID index** (`idx_kyc_unique_verified_nid`): Prevents approving a KYC if another account already has a verified record with the same NID number.
2. **Face match trigger** (`trg_validate_kyc_face_match`): Blocks approval if face match score is below 70%.

These constraints prevent admins from exercising override authority when legitimate scenarios require it (e.g., re-verification, correcting mistakes, family members sharing documents in edge cases).

### Plan

**Database Migration** — Remove both constraints:

```sql
-- Drop the unique NID restriction
DROP INDEX IF EXISTS idx_kyc_unique_verified_nid;

-- Drop the face match validation trigger
DROP TRIGGER IF EXISTS trg_validate_kyc_face_match ON public.kyc_verifications;
DROP FUNCTION IF EXISTS public.validate_kyc_face_match();
```

**Frontend Update** — Clean up the now-unnecessary error handling in `src/components/admin/AdminKycReview.tsx` (lines 193-201): simplify the error block since those specific constraint errors will no longer occur. Keep a generic error toast as fallback.

This gives admins full authority to approve or reject any KYC submission regardless of NID duplication or face match score.