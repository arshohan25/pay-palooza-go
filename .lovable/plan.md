

## Plan: Simplify Send Money Recipient Step

Based on the annotated screenshot, two changes are needed:

### 1. Remove Category Tabs
Delete the "Favourites (0)", "Auto Pay", and "Group Send" tab row (lines 518–523) and the `CategoryTab` component definition.

### 2. Auto-load Phone Contacts on Permission Grant
Instead of requiring users to manually tap "Import from Phone Contacts" every time, automatically attempt to load device contacts when the recipient step mounts:
- On mount, check `getCachedStatus("contacts")` — if already `"granted"`, call `requestContacts()` with `multiple: true` and populate `phoneContacts` state automatically.
- Keep the "Import from Phone Contacts" button as a fallback for first-time permission grant, but hide it once contacts are already loaded (`phoneContacts.length > 0`).
- After the first successful import, contacts auto-appear in the "All Contacts" section without further user action.

### Files Modified
- `src/components/SendMoneyFlow.tsx`
  - Remove `CategoryTab` component and its usage (lines 518–523)
  - Remove unused `Star`, `RefreshCw`, `Users` imports
  - Add `useEffect` that auto-loads contacts when permission is already granted
  - Conditionally hide the import button when `phoneContacts.length > 0`

