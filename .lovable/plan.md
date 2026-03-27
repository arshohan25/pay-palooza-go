

# Fix Chat Flow — Complete Overhaul

## Current State
The chat system already has: phone-based user lookup, connection requests (pending/accept/decline), direct & group chats, read receipts, typing indicators, online presence, image sharing, voice messages, reactions, forwarding, block & report, and an E2E encryption framework. The backend RPCs (`find_chat_user_by_phone`, `create_direct_chat_request`, `get_chat_participant_profiles`) are functional.

## Issues Identified

1. **Console warning**: `Function components cannot be given refs` in InboxPage — `AnimatePresence` wrapping function components without `forwardRef`
2. **"Add by Phone" UX gaps**: No user preview before sending request; no validation feedback for non-EasyPay numbers
3. **Pending requests not separated**: Chat requests mixed in with regular conversations — no dedicated "Requests" section
4. **Deleted messages still visible**: `is_deleted` messages not filtered from display
5. **No status updates**: No user status/bio feature (online presence exists but no custom status text)
6. **Chat menu incomplete for accepted chats**: Only Block/Report options, missing common actions like Mute, Clear Chat, View Profile
7. **Group management UX**: No way to add members to existing groups from chat view

## Plan

### 1. Fix AnimatePresence ref warnings
**File**: `src/pages/InboxPage.tsx`
- Wrap `NewContactSheet`, `NewGroupSheet`, `ForwardSheet` with `React.forwardRef` or use `motion.div` as direct children of `AnimatePresence`

### 2. Enhanced "Add by Phone" with user preview
**File**: `src/pages/InboxPage.tsx` (NewContactSheet component, ~line 547-626)
- After phone input, show a "Search" step that calls `findUserByPhone`
- Display found user's name, avatar, and phone in a preview card before confirming
- Show "Not found" state with clear messaging
- Add proper 11-digit BD phone validation using existing `usePhoneValidation` hook

### 3. Dedicated "Requests" section
**File**: `src/pages/InboxPage.tsx` (~line 1392-1404)
- Add a "Requests" filter tab alongside All/Unread/Groups
- Show pending conversations separately with accept/decline actions inline
- Add a badge counter for pending requests on the tab

### 4. Filter deleted messages
**File**: `src/pages/InboxPage.tsx` (~line 1195)
- Filter out messages where `is_deleted === true` from `uiMessages`
- Show "This message was deleted" placeholder instead

### 5. Enhanced chat menu for accepted conversations
**File**: `src/pages/InboxPage.tsx` (ChatView component, ~line 868-895)
- Add "Mute notifications", "Clear chat", "Send money" options to the MoreVertical menu
- For groups: add "Group info", "Add member", "Leave group" options

### 6. User status/bio display
**Database migration**: Add `status_text` column to `profiles` table
**File**: `src/pages/InboxPage.tsx` (ChatView header)
- Show custom status text below name in chat header when available
- Fallback to online/offline/phone as current behavior

### 7. UI polish and branding alignment
**File**: `src/pages/InboxPage.tsx`
- Add EasyPay branding accent to empty state
- Smooth the chat overlay transition
- Fix the "Send ৳500" quick reply to use the actual send money flow

## Summary
- 1 database migration (add `status_text` to profiles)
- 1 major file edit: `src/pages/InboxPage.tsx` (NewContactSheet rewrite, Requests tab, deleted message handling, menu enhancement)
- Minor types update will auto-generate after migration

