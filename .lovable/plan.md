

## Plan: Split Support into Live Chat & Tickets + Add Notification Sound/Visual Alert

### What Changes

**1. Split the Admin "Support" nav into two tabs: "Live Chat" and "Tickets"**

In `src/pages/AdminDashboard.tsx`:
- Replace the single `{ id: "support", label: "Support", icon: MessageCircle }` nav item with two items:
  - `{ id: "live_chat", label: "Live Chat", icon: MessageCircle }` — real-time conversations (status: "open")
  - `{ id: "tickets", label: "Tickets", icon: Ticket }` — all tickets with full status filtering (open/resolved/closed)
- Add rendering for both tabs, each using a new wrapper that passes a `mode` prop to `AdminSupportDashboard`
- Move the `supportUnread` badge to the "Live Chat" nav item

**2. Add mode prop to `AdminSupportDashboard`**

In `src/components/admin/AdminSupportDashboard.tsx`:
- Accept an optional `mode` prop: `"live_chat" | "tickets" | "all"` (default `"all"`)
- In **Live Chat** mode: only show `open` conversations, hide the status filter tabs, focus on real-time messaging
- In **Tickets** mode: show all conversations with full status filter tabs (All, Open, Resolved, Closed), focused on ticket management/triage

**3. Add notification sound + visual pulse alert on new messages**

In `src/components/admin/AdminSupportDashboard.tsx`:
- Import `playChatNotification` from `@/lib/sounds` and `haptics` from `@/lib/haptics`
- In the existing realtime listener for `support_messages` INSERT events:
  - Play notification sound via `playChatNotification()`
  - Fire haptic feedback via `haptics.notify()`
  - Add a visual pulse animation on the conversation list item that received the new message (brief green border flash using a `newMsgConvId` state that clears after 2 seconds)
- In the realtime listener for `support_conversations` INSERT events (new conversation created):
  - Play `playChatRequestSound()` from `@/lib/sounds` (3-note ascending chime)
  - Show a toast with "New support conversation from {user}" 
  - Add the same visual pulse on the new conversation entry

### Files Modified
- `src/pages/AdminDashboard.tsx` — split nav item, add two tab renderings
- `src/components/admin/AdminSupportDashboard.tsx` — add `mode` prop filtering, notification sound + visual pulse on new messages/conversations

### Technical Details
- Uses existing `playChatNotification()` and `playChatRequestSound()` from `src/lib/sounds.ts` — no new audio infrastructure needed
- Uses existing `haptics.notify()` from `src/lib/haptics.ts`
- Visual pulse: a `ring-2 ring-primary animate-pulse` class applied briefly (2s) to the conversation row that received a new message, tracked via `highlightedConvId` state
- The `mode` prop simply filters `filteredConversations` and conditionally hides the status tabs — no duplication of the component

