

## Admin KYC Warning Banners + EasyPay Email Branding

Two changes:

### 1. Non-blocking warning banners in KYC approval flow

**`src/components/admin/AdminKycReview.tsx`**

- **Remove the auto-reject logic** (lines 150-178): Currently when approving a duplicate NID, the code auto-rejects. Replace this with a non-blocking check that sets warning state instead.
- **Add state for warnings**: `duplicateNidWarning` (boolean) and track it alongside the existing flow.
- **Update the face match banner** (lines 370-383): Change from "Cannot Approve" blocking language to a warning-only banner — "⚠ Warning: Low Face Match" with advisory text. Remove the word "Cannot".
- **Add duplicate NID warning banner**: When admin clicks Approve and a duplicate NID is found, show an amber warning banner in the dialog (similar style to face match warning) saying "Another account is already verified with this NID" but allow the admin to proceed with a confirmation click.
- **Flow**: First click "Approve" → check for duplicate NID → if found, show warning banner + change button to "Confirm Approve" → second click proceeds. If no duplicate, approve immediately. Face match warning is always visible (informational only, never blocks).

### 2. Rebrand all email/SMS sender names to EasyPay

**`supabase/functions/kyc-notify/index.ts`**
- Line 113: `"MFS Bangladesh <noreply@resend.dev>"` → `"EasyPay <noreply@resend.dev>"`
- Line 127: `"MFS Bangladesh — Secure Mobile Financial Services"` → `"EasyPay — Secure Digital Wallet"`
- Line 158: `"MFS: Your KYC..."` → `"EasyPay: Your KYC..."`
- Line 159: `"MFS: Your KYC..."` → `"EasyPay: Your KYC..."`

The `send-email-otp` function already uses EasyPay branding, so no change needed there.

