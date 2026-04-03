# Redesign Agent Customer Registration Flow

## Overview

Transform the current simple form into a multi-step premium flow: Phone Entry → OTP Verification → Account Creation → Full KYC (NID capture, OCR, face verify, etc.) — all driven by the agent on behalf of the customer.

## Flow Steps

```text
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Step 1:     │    │  Step 2:     │    │  Step 3:     │    │  Step 4:     │
│  Phone Entry │───▶│  OTP Verify  │───▶│  Basic Info  │───▶│  KYC Flow    │
│  + Send OTP  │    │  6-digit     │    │  Name + NID  │    │  (embedded)  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                   │
                                                            ┌──────▼──────┐
                                                            │  Step 5:    │
                                                            │  Success    │
                                                            └─────────────┘
```

## Technical Details

### 1. Update `send-otp` Edge Function

- Add a new purpose `"agent_register"` that skips the "phone must be registered" check (since the customer doesn't exist yet)
- Still enforces rate limiting and returns `dev_otp` in dev mode

### 2. Redesign `AgentRegister.tsx` (~400 lines)

Complete rewrite with a multi-step stepper design:

**Step 1 — Phone Entry**: Premium glassmorphic card with phone input, animated "Send OTP" button. Calls `send-otp` with `purpose: "agent_register"`. Checks if phone is already registered first.

**Step 2 — OTP Verification**: 6-digit OTP input using `InputOTP` component. Auto-submit on complete. Resend timer (60s countdown). Stores `dev_otp` from response for auto-fill in dev mode.

**Step 3 — Basic Info**: Name + NID number fields (minimal). Creates the Supabase Auth account via `signUpWithPhonePassword`.

**Step 4 — Embedded KYC**: Renders the existing `KycFlow` component in "agent mode". Need to modify `KycFlow` to accept an optional `agentMode` prop that:

- Skips the intro/terms steps (agent has already verified identity)
- Uses the newly created user's ID for submission
- Skips KYC status check (fresh account)

**Step 5 — Success**: Animated completion screen with customer details summary.

### 3. Modify `KycFlow.tsx` (minimal changes)

- Add optional props: `agentMode?: boolean`, `targetUserId?: string`
- When `agentMode` is true:
  - Skip intro and terms steps, start directly at `nid_capture`
  - Use `targetUserId` instead of current user for KYC submission
  - Show "Customer KYC" labels instead of "Your KYC"

### 4. UI Design

- Animated step indicator (horizontal dots/progress bar) at the top
- Each step animates in with Framer Motion slide transitions
- Glassmorphic cards matching the app's premium visual identity
- Spring animations on buttons and step transitions
- Gradient header consistent with agent portal style
- OTP input with large, spaced digit boxes and auto-focus

## Files Changed

- `supabase/functions/send-otp/index.ts` — Add `agent_register` purpose
- `src/pages/AgentRegister.tsx` — Full rewrite with 5-step flow
- `src/components/KycFlow.tsx` — Add `agentMode` + `targetUserId` props with conditional logic