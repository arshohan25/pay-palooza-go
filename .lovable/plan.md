# Webhook setup UI: register, monitor, preview

## Current state
- `merchant_api_keys.webhook_url` already stores a per-key callback URL; the API tab has a tiny inline "Edit" affordance but no validation, no test, no delivery summary.
- `merchant-payment-webhook` edge function records delivery metadata into `merchant_payment_sessions` (`webhook_delivered`, `webhook_attempts`, `webhook_next_retry_at`) plus `metadata.webhook_status / webhook_delivered_at / webhook_error / webhook_attempted_at / webhook_permanently_failed`. The signed JSON payload it sends is fully reproducible client-side.
- No payload column exists, and adding per-delivery storage isn't necessary — the recent sessions table already has everything we need to render the last delivery + a faithful payload preview.

## Build

### 1) Promote webhook setup to its own card on the API tab
Single file: `src/components/MerchantApiTab.tsx`. Replace the cramped inline "Webhook URL" row inside each key card with a dedicated "Webhooks" sub-section per key:

```text
┌─ Webhook endpoint ───────────────────────────────┐
│  [ https://yoursite.com/webhook            ]  Save │
│  Status: ● Delivered  ·  Last attempt 14:02       │
│  18 / 20 delivered (last 50)  ·  2 pending retry  │
│  [ Send test event ]   [ View last payload ▾ ]    │
└──────────────────────────────────────────────────┘
```

- Inline URL editor with Zod validation (must be `https://`, max 2048 chars, no embedded credentials, no `localhost`/private-IP prefixes). Show a small inline error under the input on validation failure; only enable Save when the value differs from the saved one.
- Visual status pill: green "Delivered" / amber "Pending retry" / red "Failed" / muted "No deliveries yet" — derived from the most recent session belonging to this key (`api_key_id`).
- Aggregate counters from the already-loaded `sessions` array filtered by `api_key_id`: delivered, pending retry (`webhook_next_retry_at` in future), permanently failed (from `metadata.webhook_permanently_failed`).
- "Send test event" button — calls the existing `merchant-payment-webhook` edge function with a synthetic-but-real `session_id` chosen as the most recent completed session for this key. If none exists, the button is disabled with tooltip "Complete at least one test payment to send a real signed event." (The function refuses to forge sessions, so we don't introduce a new code path; this just re-fires delivery for the latest completed session.)
- "View last payload" — collapsible disclosure that reconstructs the exact JSON that the edge function would send for the most recent completed session belonging to this key:
  ```json
  {
    "event": "payment.completed",
    "session_id": "...",
    "amount": 500,
    "currency": "BDT",
    "reference": "ORDER-123",
    "status": "completed",
    "customer_phone": "017...",
    "completed_at": "2026-04-27T...",
    "timestamp": "<rendered at preview time>"
  }
  ```
  Plus the request headers Lovable Cloud actually sends:
  ```text
  X-EasyPay-Signature: sha256=<computed live from secret_key + payload>
  Content-Type: application/json
  ```
  Both blocks reuse the existing `copyText` helper for one-click copy.

### 2) "Recent deliveries" mini-table per key
Below the status pill, render the last 5 sessions for the key as a compact list:
```
COMPLETED  ৳500  ORDER-123   ● delivered  14:02   [ Resend ]
COMPLETED  ৳120  -           ● failed (HTTP 500) [ Resend ]
```
- "● failed (HTTP X)" shows `metadata.webhook_status` or `metadata.webhook_error`.
- Resend reuses the existing `retryWebhook(sessionId)` helper.

### 3) Empty state
When the key has `webhook_url = null`, hide the deliveries panel and show a primer:
```
You haven't registered a webhook yet. Add an HTTPS URL above to
receive signed payment events. We'll retry up to 5 times with
exponential backoff.
```

### 4) Signature helper (client-side)
Implement HMAC-SHA256 with the Web Crypto API to render the exact signature value in the preview, mirroring the edge function's `hmacSign`:
```ts
async function previewSignature(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return "sha256=" + Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, "0")).join("");
}
```

## Out of scope
- No DB migration. No new columns. No edge-function changes.
- No per-delivery payload archival (would require a new table and storage growth).
- No webhook subscription model (event-type filtering) — current platform only emits `payment.completed` / `payment.failed`.

Approve to apply.