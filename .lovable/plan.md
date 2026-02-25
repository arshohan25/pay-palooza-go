

## Plan: Integrate Resend to Deliver Email OTPs

### Problem
The `send-email-otp` edge function currently only logs OTP codes to the console (`[DEV]`). Users never receive the OTP in their inbox.

### Solution
Integrate the Resend email service into the existing `send-email-otp` edge function to actually send OTP codes via email.

### Prerequisites (User Action Required)
1. Sign up at [resend.com](https://resend.com) if not already done
2. Verify an email domain at [resend.com/domains](https://resend.com/domains) (or use the sandbox `onboarding@resend.dev` for testing)
3. Create an API key at [resend.com/api-keys](https://resend.com/api-keys)
4. Provide the `RESEND_API_KEY` so it can be stored securely as a backend secret

### Technical Changes

**1. Add `RESEND_API_KEY` secret**
- Use the `add_secret` tool to request the key from the user

**2. Update `supabase/functions/send-email-otp/index.ts`**
- Import Resend SDK (`npm:resend@4.0.0`)
- After generating the OTP and storing it in the database, send an email via Resend with:
  - **From**: A verified sender address (e.g., `noreply@yourdomain.com`)
  - **To**: The user's email
  - **Subject**: "Your verification code"
  - **Body**: A clean HTML email containing the 6-digit OTP code
- Remove the `dev_otp` field from the JSON response (no longer needed since real emails are sent)
- Keep the console log as a fallback/audit trail but mark it differently

### No Other Changes Needed
- The frontend (`ProfileEditFlow.tsx`) already handles the OTP input and verification flow
- The database schema (`otp_codes` table) remains unchanged
- The verify action in the same edge function remains unchanged

