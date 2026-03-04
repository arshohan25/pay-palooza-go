

## Fix Real-Time Chat and Calls

### Root Causes Identified

1. **Duplicate WebRTC subscriptions causing call failures**: When a user opens a conversation, two separate `WebRTCManager` instances subscribe to the same Supabase Broadcast channel — one from the per-conversation effect (line 1177) and one from the global listener (line 1189). This creates race conditions where signals may be handled by the wrong manager instance, or the global listener's `destroy()` cleanup tears down channels the active conversation still needs.

2. **`chat_conversations` not in realtime publication**: The `chat_conversations` table is missing from the `supabase_realtime` publication. When one user sends a message and the hook updates `chat_conversations.updated_at`, other clients won't see conversation order changes in real-time.

### Changes

**1. Database migration: Add `chat_conversations` to realtime publication**
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;`
- This enables real-time conversation ordering updates.

**2. Fix WebRTC dual-subscription conflict in `src/pages/InboxPage.tsx`**
- Remove the per-conversation WebRTC effect (lines 1177-1186) that creates a second manager when `activeContactId` changes.
- Refactor the global incoming call listener (lines 1189-1208) to also serve as the active call manager. When a conversation is active, reuse the manager from the global set instead of creating a new one.
- Store the global managers in a `useRef<Map>` so `handleCall` can look up the correct manager for the active conversation.
- This eliminates duplicate channel subscriptions and ensures signals are handled by exactly one manager.

**3. Improve realtime subscription resilience in `src/hooks/use-chat.ts`**
- Add status handling to the `.subscribe()` call to log connection issues.
- Subscribe to `chat_conversations` UPDATE events so conversation list order updates in real-time when the other party sends a message.

### Files
- **DB Migration**: Add `chat_conversations` to realtime publication
- **Edit**: `src/pages/InboxPage.tsx` — consolidate WebRTC managers into a single ref-based map
- **Edit**: `src/hooks/use-chat.ts` — add `chat_conversations` realtime subscription + connection status logging

