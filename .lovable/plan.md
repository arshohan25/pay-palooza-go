

## Chat Request Accept/Decline Flow + Sound/Vibration Alerts

### Current Behavior
- When user A starts a conversation with user B, the conversation is immediately created and visible to both parties. User B receives a notification in the `notifications` table but there's no acceptance gate.
- No audio or haptic feedback when chat notifications arrive.

### Plan

#### 1. Database: Add `status` column to `chat_conversations`
- Add a `status` column (`pending` | `accepted`) to `chat_conversations`, default `accepted`.
- When creating a **new direct conversation**, set `status = 'pending'`.
- Update RLS: participants can still SELECT pending conversations (to see the request), but the INSERT policy on `chat_messages` should block sending messages in `pending` conversations unless sender is the original creator (only the first message allowed).

**Migration:**
```sql
ALTER TABLE chat_conversations ADD COLUMN status text NOT NULL DEFAULT 'accepted';
-- For pending conversations, only the initiator can send messages
-- Recipients must accept before they can reply
```

#### 2. Update `createDirectConversation` in `use-chat.ts`
- Set `status: 'pending'` when inserting a new conversation.
- The sender's initial message can still be sent (acts as the "request message").

#### 3. Add accept/decline functions to `use-chat.ts`
- `acceptConversation(conversationId)`: Updates `chat_conversations.status` to `'accepted'`.
- `declineConversation(conversationId)`: Deletes the conversation and its participants (or marks it declined). Removes self from participants.

#### 4. Update InboxPage UI — Chat Request Banner
- In the conversation list, show pending conversations with a distinct visual style (e.g., "Chat Request" badge, muted appearance).
- When opening a pending conversation as the recipient:
  - Show the sender's first message.
  - Display an **Accept / Decline** bar at the bottom instead of the message input.
  - Accept → updates status to `accepted`, shows normal chat input.
  - Decline → removes conversation from list, optionally notifies sender.

#### 5. Sound alert on new chat notification
- Create a `playNotificationSound()` function in a new `src/lib/sounds.ts` using the Web Audio API (consistent with existing audio patterns in the app).
- Play a short notification chime (ascending 2-note pattern) when:
  - A new chat message arrives via realtime (in `use-chat.ts` realtime handler).
  - A new chat request notification arrives.

#### 6. Haptic feedback on new chat notification
- Use existing `haptics.notify()` from `src/lib/haptics.ts` when a new realtime message arrives from another user.
- Trigger both sound + haptic together in the realtime handler.

### Files to Change
- **Database migration**: Add `status` column to `chat_conversations`
- **`src/hooks/use-chat.ts`**: Add `status: 'pending'` on create, add `acceptConversation`/`declineConversation`, trigger sound+haptic on incoming message
- **`src/pages/InboxPage.tsx`**: Visual distinction for pending requests, accept/decline UI bar
- **`src/lib/sounds.ts`** (new): Chat notification sound using Web Audio API

