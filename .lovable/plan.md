

## Persistent Payment Links with Payment Tracking

### Problem
Currently, merchant payment links are generated client-side and stored in React state — they disappear on page refresh. There's no tracking of payments received per link.

### Solution
Persist payment links to the `payment_links` database table and track payments against each link using the existing `merchant_payment_sessions` table.

---

### Database Changes

**1. Add `merchant_id` column to `payment_links`**
The existing table has `created_by` (user UUID) but no merchant reference. Add:
- `merchant_id UUID REFERENCES merchants(id)` — links the payment link to a merchant
- `merchant_code TEXT` — stores the merchant QR code (e.g. `MRC-RAFIQ-001`) used in the /pay URL
- `note TEXT` — description/note for the link

**2. Add `payment_link_id` column to `merchant_payment_sessions`**
- `payment_link_id UUID REFERENCES payment_links(id)` — tracks which link generated this payment session
- This allows querying all payments received through a specific link

**3. RLS policies on `payment_links`**
- Merchants can SELECT/INSERT/UPDATE/DELETE their own links (via `merchant_id` matching their merchant record)

---

### Code Changes

**`src/pages/MerchantDashboard.tsx` — PayLinksTab rewrite:**
- Replace in-memory `links` state with DB-backed data from `payment_links` table
- `generateLink()` → INSERT into `payment_links` with merchant_id, amount, note, short_code
- `removeLink()` → UPDATE `is_active = false` (soft delete/revoke) or hard DELETE
- Add a "Revoke" toggle per link (sets `is_active = false`)
- Load links on mount with realtime subscription for live updates
- Show payment count per link (`used_count` column or join query to `merchant_payment_sessions`)
- Add an expandable section per link showing recent payments received through it

**Payment tracking per link:**
- Each link card shows: amount, note, status (active/revoked), created date, **total payments received**, **total amount collected**
- Tapping a link expands to show individual payment transactions

**`src/pages/PayPage.tsx` — Link payment link to session:**
- When /pay is loaded via a payment link URL, pass the `ref` param to identify the link
- After successful payment, the `checkout-guest` edge function can record the association

**`supabase/functions/checkout-guest/index.ts`:**
- After successful payment, look up the `payment_links` row by short_code matching the `reference` param
- If found, increment `used_count` on the payment link

---

### Summary of changes
- 1 migration (add columns + RLS)
- 1 file rewrite: `PayLinksTab` in MerchantDashboard.tsx
- 1 edge function update: `checkout-guest` to increment link usage
- No expiration by default — links stay valid until merchant revokes/deletes them

