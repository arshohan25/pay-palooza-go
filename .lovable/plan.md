

## Add Message Read Receipts via Supabase Realtime

### Problem
Currently `msgToUIMessage` hardcodes `status: "read"` for all messages (line 161 of InboxPage.tsx). The `last_read_at` field on `chat_participants` is already written when opening a conversation but never consumed for per-message read receipt display, and changes aren't broadcast in real-time.

### Approach
Use the existing `chat_participants.last_read_at` column — no DB schema changes needed. Enable realtime on `chat_participants` to detect when another user reads messages. Compute per-message status by comparing `msg.created_at` against the other participants' `last_read_at`.

### Changes

**1. Edit: `src/hooks/use-chat.ts`**
- Subscribe to realtime `UPDATE` events on `chat_participants` (in addition to existing `chat_messages` INSERT subscription)
- When a participant's `last_read_at` changes, update the conversation's participant data locally so the UI re-renders with correct read status
- Expose `participantReadTimes: Map<string, Map<string, string>>` — maps `conversationId → userId → last_read_at` for the UI to compute per-message status

**2. Edit: `src/pages/InboxPage.tsx`**
- Update `msgToUIMessage` to accept read times from other participants
- Compute status: if `msg.created_at <= min(others' last_read_at)` → "read", else if message was sent → "delivered", else "sent"
- Show double blue checkmarks for read, double gray for delivered, single gray for sent (icons already imported: `CheckCheck`, `Check`)
- When the user opens a conversation and `openConversation` updates `last_read_at`, the realtime subscription on the sender's side will pick it up and flip their message status to "read"

**3. Enable realtime on `chat_participants`**
- DB migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;`

### Files
- **DB Migration**: Enable realtime on `chat_participants`
- **Edit**: `src/hooks/use-chat.ts` — add realtime subscription for participant updates, expose read times
- **Edit**: `src/pages/InboxPage.tsx` — compute and display per-message read/delivered/sent status

