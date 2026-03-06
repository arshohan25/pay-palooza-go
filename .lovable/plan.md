

## Plan: Fix Inbox Chat Issues

### Issues identified
1. **"[Old message]" bubbles** — Old encrypted messages were bulk-replaced with "[Old message]" in the database. These should be hidden or displayed as a subtle system note instead of full chat bubbles.
2. **Loading spinner on inbox** — The full-screen loading spinner (lines 1481-1489) blocks the UI. Remove it so the conversation list renders immediately.
3. **Excess empty space in chat** — The empty state area and message spacing create too much whitespace.

### Changes to `src/pages/InboxPage.tsx`

#### 1. Remove inbox loading spinner
- Delete lines 1481-1489 (the `if (chat.loading) return (...)` block) so the inbox renders immediately, showing conversations as they load.

#### 2. Filter/style "[Old message]" messages
- In the `MessageBubble` component, detect when `msg.text === "[Old message]"` and render a small muted system note (e.g., italic gray text "Previous message unavailable") instead of a full green/white chat bubble. This removes the visual clutter of old placeholder messages.

#### 3. Reduce excess spacing in chat view
- Reduce the empty state padding from `py-16` to `py-10` (line 979)
- Tighten message gap from `space-y-3` to `space-y-2` (line 977)

### Files modified
- `src/pages/InboxPage.tsx`

