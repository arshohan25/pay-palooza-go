## Real-Time Merchant Payment Gateway API

### Overview

Build a complete Merchant API system that allows merchants to integrate EasyPay payments into their external websites. This includes: API key management, a public-facing checkout page, a server-side payment processing edge function, and real-time payment status updates via webhooks/polling.

### Architecture

```text
External Website                    EasyPay Platform
┌──────────────┐    POST /create    ┌────────────────────┐
│  Merchant's  │ ──────────────────>│ merchant-payment-api│ (Edge Function)
│  Website     │ <──────────────────│  - validates API key│
│              │   { checkout_url,  │  - creates session  │
│              │     session_id }   └────────────────────┘
└──────┬───────┘                              │
       │ redirect                             ▼
       │                           ┌────────────────────┐
       └──────────────────────────>│ /checkout/:id       │ (New React Page)
                                   │  - shows amount     │
                                   │  - user logs in/PIN │
                                   │  - OTP verification │
                                   │  - processes payment│
                                   │  - redirects back   │
                                   └────────┬───────────┘
                                            │ POST callback_url
                                            ▼
                                   ┌────────────────────┐
                                   │ Merchant's webhook  │
                                   │  { status, amount,  │
                                   │    reference }      │
                                   └────────────────────┘
```

### Database Changes (Migration)

**New table: `merchant_api_keys**`

- `id` (uuid PK)
- `merchant_id` (uuid → merchants.id)
- `api_key` (text, unique) — public key for identifying merchant
- `secret_key` (text) — used for webhook signature verification
- `webhook_url` (text, nullable) — merchant's callback URL
- `is_active` (boolean, default true)
- `created_at`, `updated_at`
- RLS: merchant can read own keys, admin can read all

**New table: `merchant_payment_sessions**`

- `id` (uuid PK)
- `merchant_id` (uuid → merchants.id)
- `api_key_id` (uuid → merchant_api_keys.id)
- `amount` (numeric)
- `currency` (text, default 'BDT')
- `reference` (text) — merchant's order reference
- `description` (text, nullable)
- `customer_phone` (text, nullable)
- `payer_user_id` (uuid, nullable) — filled after payer authenticates
- `status` (text: pending → processing → completed → failed → expired)
- `callback_url` (text, nullable) — override per-session
- `success_url` (text, nullable) — redirect after success
- `cancel_url` (text, nullable) — redirect after cancel
- `webhook_delivered` (boolean, default false)
- `completed_at` (timestamp, nullable)
- `expires_at` (timestamp) — auto-expire after 30 min
- `metadata` (jsonb)
- `created_at`, `updated_at`
- RLS: merchant can read own sessions, admin can read all
- Enable realtime for live status updates

### Edge Functions

**1. `merchant-payment-api` (New)**
Public endpoint (no JWT). Validates merchant API key from header. Actions:

- `create_session` — creates a merchant_payment_session, returns checkout URL + session_id
- `check_status` — returns session status by session_id (requires API key)
- `list_sessions` — paginated list of sessions for the merchant

**2. `merchant-payment-webhook` (New)**
Internal function called after payment completion to POST status to merchant's webhook_url with HMAC signature using secret_key.

### New Pages

`**/checkout/:sessionId**` — Public checkout page

- Fetches session details (amount, merchant name, description)
- If expired → show expired message
- Customer enters phone + PIN to pay
- Uses `transfer_money` RPC (sender = customer, recipient = merchant phone)
- On success: update session status → trigger webhook → redirect to success_url
- On failure/cancel: redirect to cancel_url

### Merchant Dashboard Updates (`MerchantDashboard.tsx`)

Add new tab **"API Integration"** to the menu:

- **API Keys section**: Generate/revoke API keys, show key + secret (once on creation)
- **Webhook URL**: Configure callback URL
- **Integration Guide**: Code snippets (cURL, JavaScript, PHP) showing how to create a payment session
- **API Logs**: List of recent merchant_payment_sessions with status

### Files to Create/Modify


| File                                                   | Action                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| Migration SQL                                          | New tables: `merchant_api_keys`, `merchant_payment_sessions` |
| `supabase/functions/merchant-payment-api/index.ts`     | New edge function                                            |
| `supabase/functions/merchant-payment-webhook/index.ts` | New edge function                                            |
| `src/pages/CheckoutPage.tsx`                           | New public checkout page                                     |
| `src/pages/MerchantDashboard.tsx`                      | Add "API" tab with key mgmt + docs                           |
| `src/App.tsx`                                          | Add `/checkout/:sessionId` route                             |
| `supabase/config.toml`                                 | Register new functions                                       |


### Integration Example (shown to merchant)

```javascript
// Create payment session
const res = await fetch('https://<project>.supabase.co/functions/v1/merchant-payment-api', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key'
  },
  body: JSON.stringify({
    action: 'create_session',
    amount: 500,
    reference: 'ORDER-123',
    description: 'Blue T-Shirt',
    success_url: 'https://yoursite.com/success',
    cancel_url: 'https://yoursite.com/cancel'
  })
});
const { checkout_url, session_id } = await res.json();
// Redirect customer to checkout_url
window.location.href = checkout_url;
```

### Security

- API keys generated as crypto-random hex strings
- Webhook payloads signed with HMAC-SHA256 using secret_key
- Sessions auto-expire after 30 minutes
- Rate limiting on session creation (max 100/hour per merchant)
- Amount validation (min ৳1, max ৳1,000,000)