

## Add Typing Indicators via Supabase Presence

### Approach
Use Supabase Realtime Presence channels (ephemeral, no DB needed) to broadcast typing state per conversation.

### Changes

**1. New hook: `src/hooks/use-typing-indicator.ts`**
- Accepts `conversationId` and `userId`/`userName`
- Creates a Supabase Presence channel `typing:{conversationId}`
- Exposes `setTyping(isTyping: boolean)` — tracks/shares typing state with a debounced auto-off (3s timeout)
- Exposes `typingUsers: string[]` — names of other users currently typing, derived from presence state
- Cleans up channel on unmount

**2. Edit: `src/pages/InboxPage.tsx`**

In `ChatView`:
- Import and use `useTypingIndicator(conversationId, userId, userName)`
- Call `setTyping(true)` on input `onChange`, which auto-resets after 3s of no typing
- Render a typing indicator bubble between the last message and the `bottomRef` div:
  - Animated three-dot bounce animation
  - Shows "{name} is typing..." or "2 people are typing..."
- Pass `conversationId` and user info as new props to `ChatView`

In `InboxPage`:
- Pass the active conversation ID and user profile info down to `ChatView`

### Typing Indicator UI
A small row below messages showing animated dots + user name, styled like a received message bubble but smaller and translucent. Uses framer-motion for the bouncing dots animation.

### Files
- **New**: `src/hooks/use-typing-indicator.ts`
- **Edit**: `src/pages/InboxPage.tsx` — add typing indicator to ChatView

