

# Redesign Agent Register KYC Flow — Real-Time Status + Customer Onboarding

## Overview

After the agent submits KYC on behalf of a customer, the flow will show a **real-time KYC status tracker** that listens for admin approval/rejection. Once approved, the customer receives a download link and the agent can guide them through first login (phone → OTP → set PIN).

## Flow (Updated Steps)

```text
Phone → OTP → Info → KYC Capture → KYC Submitted (Real-time tracker)
                                          │
                                    ┌─────┴──────┐
                                    │  APPROVED   │  REJECTED
                                    ▼             ▼
                              Download Link    Rejection reason
                              + "Open App"     + "Retry KYC" button
                                    │
                                    ▼
                              Customer Login Guide
                              (Phone → Auto-detect OTP → Set PIN)
```

## Technical Details

### 1. AgentRegister.tsx — New post-KYC steps

Replace the simple "success" step with three new steps:

- **`kyc_waiting`**: Real-time KYC status card. Subscribes to `postgres_changes` on `kyc_verifications` table filtered by `targetUserId`. Shows animated pending spinner, live status badge (Pending → Verified/Rejected). Plays chime + confetti on approval.

- **`approved`** (on verified): Shows success animation, EasyPay download link (`https://pay-palooza-go.lovable.app`), QR code for download, and a "Guide Customer Login" button to proceed.

- **`rejected`** (on rejected): Shows rejection reason from `reviewer_notes`, option to retry KYC from NID capture step, and animated error state.

- **`customer_login`**: A guided 3-step mini-flow showing the customer what to do after downloading:
  1. Enter phone number (pre-filled, read-only)
  2. OTP verification with auto-detect hint (using `OTPCredential` API where supported)
  3. Set 4-digit PIN (with confirmation)

### 2. Real-time subscription logic

```typescript
// Subscribe to KYC status changes for the new customer
const channel = supabase
  .channel(`agent-kyc-${targetUserId}`)
  .on("postgres_changes", {
    event: "UPDATE",
    schema: "public",
    table: "kyc_verifications",
    filter: `user_id=eq.${targetUserId}`,
  }, (payload) => {
    if (payload.new.status === "verified") goTo("approved");
    if (payload.new.status === "rejected") {
      setRejectionReason(payload.new.reviewer_notes);
      goTo("rejected");
    }
  })
  .subscribe();
```

### 3. OTP Auto-detect (WebOTP API)

For the customer login step, use the `OTPCredential` API for auto-detection:
```typescript
if ("OTPCredential" in window) {
  const ac = new AbortController();
  navigator.credentials.get({ otp: { transport: ["sms"] }, signal: ac.signal })
    .then(otp => setOtpValue(otp.code));
}
```
This shows the native "auto-fill OTP" prompt on supported Android Chrome browsers.

### 4. Customer PIN Setup

After OTP verification, show a PIN setup screen (4-digit, with confirmation and weak-PIN validation using existing `isWeakPin`). This calls `changePin()` from `@/lib/auth` to replace the random PIN set during registration.

### 5. UI Design

- **KYC Waiting**: Pulsing gradient ring animation around a shield icon, live "Waiting for approval..." text with dot animation, elapsed time counter
- **Approved**: Confetti burst, green gradient success card, app download QR code, prominent CTA button
- **Rejected**: Red gradient card with `AlertTriangle` icon, rejection reason in a bordered callout, "Retry" button
- **Customer Login Guide**: Step-by-step cards with numbered circles, auto-detect OTP badge, PIN dot indicators matching AuthPage style

## Files Changed

- `src/pages/AgentRegister.tsx` — Add `kyc_waiting`, `approved`, `rejected`, `customer_login` steps with real-time subscription, OTP auto-detect, and PIN setup
- No changes to `KycFlow.tsx` — it already works correctly in agent mode

