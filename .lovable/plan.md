## Goal
Improve the Merchant API access request flow on the gate (`MerchantApiAccessGate`) and the support chat hand-off so merchants get clearer status and a faster start.

## Changes

### 1. `src/components/MerchantApiAccessGate.tsx`
- **Disable CTA when a pending request exists.** If `latest.status === "pending"`, render the button as `disabled` with label "Request Pending — Awaiting Review". Approved status already hides the gate; rejected remains enabled ("Request Again via Live Chat").
- **Show "last submitted" timestamp** prominently next to the CTA (e.g. "Last submitted: 2h ago") using a relative time helper, in addition to the existing absolute timestamp inside the status block.
- **Add a secondary "Open Live Chat" link** under the disabled CTA so a pending merchant can still continue the conversation in support without creating a new request row.
- **Build a prefill template** when handing off to chat:
  ```
  Hi EasyPay team, I'd like to request API access for my merchant account.
  Merchant ID: {merchantId ?? "—"}
  Purpose: [briefly describe how you'll use the API — webhooks, checkout, payouts, etc.]
  ```
  Pass this as a query param: `navigate('/account?openChat=1&prefill=<encoded>')`.

### 2. `src/components/SupportChat.tsx`
- Accept a new optional prop `initialDraft?: string`.
- On mount, if `initialDraft` is provided and `input` is empty, set `setInput(initialDraft)` and focus the input. The user can edit or delete freely before sending — nothing is auto-sent.

### 3. `src/pages/AccountPage.tsx`
- In the existing `?openChat=1` effect, also read `prefill` query param, decode it, store in state (`chatDraft`), and strip both params from the URL.
- Pass `<SupportChat userId={userId} initialDraft={chatDraft} />`.

## Technical Notes
- Relative time: small inline helper (no new dep) — minutes/hours/days ago, fallback to locale date for >7d.
- Pending detection already wired via realtime subscription on `merchant_api_access_requests` for that user, so the button will re-enable automatically when admin marks it approved/rejected.
- No DB schema changes; no RLS changes.
- No edge function changes.

## Files Touched
- `src/components/MerchantApiAccessGate.tsx`
- `src/components/SupportChat.tsx`
- `src/pages/AccountPage.tsx`
