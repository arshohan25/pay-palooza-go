

## Add Online/Offline Presence Indicators via Supabase Presence

### Approach
Create a new hook that tracks all users' online status using a global Supabase Presence channel. Each authenticated user joins a shared `online-users` channel and tracks their presence. The hook returns a `Set<string>` of currently online user IDs.

### Changes

**1. New hook: `src/hooks/use-online-presence.ts`**
- Joins a global Supabase Presence channel `online-users` with the current user's ID
- Listens to `sync` events to maintain a `Set<string>` of online user IDs
- Exposes `isOnline(userId: string): boolean`
- Auto-tracks presence on mount, untracks + removes channel on unmount
- Handles page visibility (goes offline when tab hidden, back online when visible)

**2. Edit: `src/pages/InboxPage.tsx`**
- Import and use `useOnlinePresence` in `InboxPage`
- Pass the `isOnline` function into `convToUIContact` so that `online` field reflects real presence state instead of hardcoded `false`
- In the contact list avatar, the existing green dot indicator (if any) will now reflect actual status
- In `ChatView` header, show a small "Online" / "Offline" text below the contact name

**3. UI indicators**
- Contact list: Small green/gray dot on avatar corner (absolute positioned, bottom-right)
- Chat header: "Online" text in green or "Offline" in muted color below name
- Animate the dot with a subtle pulse for online users

### Files
- **New**: `src/hooks/use-online-presence.ts`
- **Edit**: `src/pages/InboxPage.tsx` — wire up presence, update avatar dots and chat header

