## Goal

After a merchant verifies their phone via OTP on the Forgot-PIN flow, drop them straight into a working live-chat thread tied to the existing `merchant_pin_reset_requests` row — without requiring them to sign in. Admins reply from a new "PIN reset queue" panel.

## Why the current screen is wrong

`MerchantSupportPage` only renders `SupportChat` when `supabase.auth.getSession()` returns a user. The whole `support_conversations` / `support_messages` stack is keyed to `auth.uid()` via RLS, so a logged-out merchant hits the "Sign in to continue" wall — exactly what the screenshot shows. We need a second, narrower chat surface that works for guests holding a valid OTP ticket.

## Design

```text
Forgot-PIN sheet  ──OTP verified──▶  /merchant-support?ticket=<request_id>&t=<otp_ticket>
                                            │
                                            ▼
                                MerchantSupportPage (guest mode)
                                            │
                                            ▼
                            <PinResetTicketChat ticketId t />
                                            │
                  ┌─────────────────────────┼──────────────────────────┐
                  ▼                         ▼                          ▼
       merchant-pin-reset-chat       merchant_pin_reset_messages    Admin "PIN Reset Queue"
       (edge fn, validates OTP)        (new table, RLS-locked)      (in AdminSupportDashboard)
```

### 1. New table `public.merchant_pin_reset_messages`

| column           | type                       | notes                           |
|------------------|----------------------------|---------------------------------|
| `id`             | uuid pk                    | gen_random_uuid()               |
| `request_id`     | uuid not null              | FK → `merchant_pin_reset_requests(id)` on delete cascade |
| `sender_role`    | text not null              | `'merchant'` or `'admin'`        |
| `sender_admin_id`| uuid null                  | set when admin replies           |
| `content`        | text not null              | plaintext (no E2E for guest flow)|
| `created_at`     | timestamptz default now()  |                                 |
| `read_by_admin`  | bool default false         |                                 |
| `read_by_merchant`| bool default false        |                                 |

Indexes on `(request_id, created_at)`. Realtime publication added.

### 2. RLS

- Reads/writes by merchants are **never direct from the client**. RLS:
  - SELECT/INSERT/UPDATE: only `has_role(auth.uid(), 'admin')`.
  - All guest interaction goes through edge functions that present the OTP ticket.

### 3. Edge functions (new + extend existing)

**New `merchant-pin-reset-chat`** with three actions, each requires `{ request_id, otp_ticket, ... }`:

- `action: "fetch"` → returns messages + ticket status after verifying ticket signature, phone match, expiry, and that ticket's phone matches the request's phone.
- `action: "send"` → inserts a `'merchant'` message after the same verification, marks admin-unread.
- `action: "ack"` → marks admin messages `read_by_merchant = true`.

The OTP ticket from `verify-otp` already encodes `{phone, purpose: 'merchant_pin_reset', exp}`. We will:
- Bump `exp` to **30 min** for the `merchant_pin_reset` purpose only (not the 2 min device-verify path), so the chat stays usable.
- Re-sign / refresh the ticket on each successful `fetch` so an active conversation keeps the merchant in.

**Extend `merchant-forgot-pin`** to return the inserted `request_id` so the client can navigate with `?ticket=<id>`.

### 4. Frontend

**`MerchantForgotPinSheet.goToLiveSupport`** — change navigation to:
`/merchant-support?ticket=<request_id>&t=<otp_ticket>` (no `openChat`, no prefill needed, the chat is the page).

**`MerchantSupportPage`** — when `?ticket` + `?t` are present, render a new `PinResetTicketChat` instead of the auth-gated `SupportChat`. Header keeps the merchant theme. Sign-in fallback is only shown when neither `?ticket` nor a session exists.

**New `src/components/merchant/PinResetTicketChat.tsx`** — bubble UI mirroring `SupportChat`'s look (welcome bubble, user-right / admin-left, send composer, realtime via Supabase channel filtered on `request_id`). Uses `supabase.functions.invoke('merchant-pin-reset-chat', ...)` for fetch/send/ack. Shows ticket status pill ("Waiting for support" / "Agent online" via realtime presence on a `pin-reset-<id>` channel). Auto-poll fallback every 8 s if realtime is blocked.

### 5. Admin surface

In **`AdminSupportDashboard`** add a new tab/section "PIN Reset" that:
- Lists open `merchant_pin_reset_requests` (newest first), shows masked phone, source, OTP-verified flag (parsed from note prefix), unread-message badge.
- Selecting one opens a chat panel that reads/writes `merchant_pin_reset_messages` directly (admin RLS allows it). Uses realtime postgres_changes filtered on `request_id`.
- Provides "Mark resolved" → updates `merchant_pin_reset_requests.status='resolved'`, sends a final system message, and locks further merchant input.

### 6. Watchdog already fixed

`useMerchantSessionWatchdog` was updated last turn to skip `/merchant-support`, so no false "session expired" toast during the handoff.

## Files

- `supabase/migrations/<ts>_pin_reset_chat.sql` — new table, indexes, RLS, realtime publication
- `supabase/functions/merchant-pin-reset-chat/index.ts` — new edge function (fetch/send/ack)
- `supabase/functions/merchant-forgot-pin/index.ts` — return `request_id`
- `supabase/functions/verify-otp/index.ts` — extend ticket lifetime to 30 min for `merchant_pin_reset`
- `src/components/merchant/PinResetTicketChat.tsx` — new
- `src/pages/MerchantSupportPage.tsx` — branch on `?ticket` + `?t`
- `src/components/merchant/MerchantForgotPinSheet.tsx` — pass through `request_id` and ticket in URL
- `src/components/admin/AdminSupportDashboard.tsx` — add PIN Reset queue tab + chat panel

## Out of scope

- E2E encryption on guest tickets (intentionally plaintext on server; ticket already proves phone ownership).
- Migrating the verified guest into a full account — that happens after admins reset the PIN and the merchant signs in normally.
- Push notifications to the guest (no auth, no subscription).
