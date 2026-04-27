# SMS Fallback for Merchant Approval Notifications

Add a Twilio SMS as a third delivery channel in `notify-merchant-approval`, sent **only when both push and email fail or are skipped**, so merchants always learn the decision.

## Behavior

After the existing push (1), in-app (2), and email (3) blocks, evaluate success:

- `pushOk` = push response had no error/skipped flag and returned `success: true` or `sent > 0`
- `emailOk` = email returned `success: true` from Resend

If `!pushOk && !emailOk` → send SMS via Twilio. Otherwise mark SMS as `skipped: "primary channels delivered"` (no spend, no duplicate noise).

## SMS content (dynamic merchant name + CTA)

Compact ≤320 chars, single segment when possible:

- Approved: `EasyPay: {biz} is approved! Open your Merchant dashboard to add bank details & list products. https://pay-palooza-go.lovable.app/merchant`
- Rejected: `EasyPay: Action needed for {biz}. Reason: {reason ≤80 chars}. Review & resubmit: https://pay-palooza-go.lovable.app/merchant`

Business name truncated to 30 chars to keep within SMS budget.

## Phone resolution & formatting

- Add `phone` to the existing `profiles` select (next to `email, name`)
- Reuse the BD formatter from `notify-recipient`: `01...` → `+8801...`, otherwise prepend `+` if missing
- Skip with `{ skipped: "no phone on profile" }` if absent

## Twilio integration

Use the same direct-API pattern already in `supabase/functions/notify-recipient/index.ts` (Basic Auth, `Messages.json`, `application/x-www-form-urlencoded`). Required secrets — already configured for `notify-recipient`:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

If any are missing → `{ skipped: "twilio not configured" }`.

## Result tracking

Append `results.sms` to the JSON response with one of:
- `{ success: true, sid, fallback: true, reason: { pushOk, emailOk } }`
- `{ error, fallback: true }`
- `{ skipped: "primary channels delivered" | "no phone on profile" | "twilio not configured" }`

The 10-minute idempotency guard at the top of the function already prevents repeat SMS for the same merchant+status transition.

## Files to edit

- `supabase/functions/notify-merchant-approval/index.ts` — add `phone` to profile select, add SMS fallback block after the email block, redeploy

## Out of scope

- No DB changes
- No new secrets (Twilio already configured)
- No UI changes (admin preview already shows push + email; SMS body mirrors the email subject + CTA so no separate template tab needed)
