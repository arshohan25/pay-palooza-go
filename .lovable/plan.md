## Goal

1. Make the merchant support chat feel instantly connected (no long "Connecting…" wait).
2. Ensure messages flow real-time both ways between merchant and admin.
3. Remove the right-side chevron icon on the drawer handle (the icon circled in the 2nd screenshot).

---

## 1. Instant-connect experience (`PinResetTicketChat.tsx`)

Today, the chat sits in a "Connecting you to support…" skeleton state while `MerchantForgotPinSheet` resolves `request_id` in the background, and again while the first `fetch` round-trips. We'll treat the screen as ready immediately:

- Drop the bootstrapping skeleton + "Connecting you to support…" line. The welcome bubble already explains what to do.
- Composer becomes usable instantly:
  - Placeholder changes from `"Connecting…"` → `"Type your message…"` even while `requestId === "pending"`.
  - If user types and presses Send before `request_id` resolves, queue the message locally (optimistic bubble + "sending…" tick), then auto-flush once `requestId` is set (existing `pin-reset-request-resolved` event already wires this).
  - Same for attachments — defer `attach_init` until the id resolves; show a subtle inline "Preparing upload…" instead of an error toast.
- Remove the `stillConnecting` gate in the composer; only show the spinner inside the Send button while a single send is actually in-flight.
- Keep the existing realtime channel + 8s polling fallback unchanged.

Net effect: user lands on the chat with the welcome bubble already visible and an active composer; the few hundred ms it takes for the edge function to return `request_id` happens silently in the background.

## 2. Real-time sync with admin

The wiring already exists, but make sure both directions are reliable:

- Confirm `merchant_pin_reset_messages` is in the `supabase_realtime` publication (check via `supabase--read_query` on `pg_publication_tables`). If missing, add a migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_pin_reset_messages;` and `ALTER TABLE public.merchant_pin_reset_messages REPLICA IDENTITY FULL;`.
- In `AdminPinResetQueue.tsx`, verify it subscribes to the same `postgres_changes` events (INSERT for new merchant messages, UPDATE for read receipts). If it only polls, add a realtime channel mirroring the merchant side so admin sees merchant replies instantly without refresh.
- Tighten the merchant-side polling fallback from 8s → 4s purely as a safety net for flaky realtime.

## 3. Remove the chevron toggle icon (`MerchantSupportPage.tsx`)

The 2nd screenshot circles the small chevron-down button anchored on the right of the drawer's grab-handle row. Remove the entire `<span className="absolute right-3 …">{ChevronDown/ChevronUp}</span>` element. The center pill handle stays — it remains the visual affordance and the whole row is still tappable + draggable to open/close.

Drop the now-unused `ChevronDown` / `ChevronUp` imports.

---

## Files to edit

- `src/components/merchant/PinResetTicketChat.tsx` — instant-ready UX, queued send while `requestId === "pending"`, drop skeleton.
- `src/pages/MerchantSupportPage.tsx` — remove chevron icon button + unused imports.
- `src/components/admin/AdminPinResetQueue.tsx` — add/confirm realtime subscription so admin sees new merchant messages live.
- New migration (only if publication check shows it's missing) to enable realtime on `merchant_pin_reset_messages`.
