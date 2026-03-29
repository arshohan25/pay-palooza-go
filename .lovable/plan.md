

# Import Phone Contacts Into App (bKash/Nagad Style)

## Problem
Currently, the app uses the **Web Contact Picker API** which opens the native OS contact picker every time. Users must manually select contacts each session. The user wants contacts to be **imported once and stored in-app**, displayed within the app's own UI — like bKash, Nagad, and Rocket do.

## Current Behavior
1. User taps "Allow Contact Access" → native picker opens (screenshot)
2. User manually selects contacts → they appear in the list
3. On next visit, the native picker opens **again** (line 246-254 in SendMoneyFlow)

## Desired Behavior
1. First time: Tap "Allow Contact Access" → native picker opens → user selects ALL contacts → contacts are **saved to localStorage**
2. Every subsequent visit: Contacts load instantly from local storage, no native picker
3. A "Refresh/Sync Contacts" button to re-import if needed

## Changes

### 1. New utility: `src/lib/contactStore.ts`
- `saveContacts(contacts: Contact[])` — persist to localStorage key `ezypay_phone_contacts`
- `loadContacts(): Contact[]` — read from localStorage
- `clearContacts()` — for refresh flow
- Normalize and deduplicate by phone number before saving

### 2. Update `src/components/SendMoneyFlow.tsx`
- **On mount**: Load contacts from `contactStore.loadContacts()` instead of calling `requestContacts()` (remove lines 245-254 that re-trigger native picker)
- **On "Allow Contact Access" grant**: Save picked contacts via `contactStore.saveContacts()`, then set `phoneContacts` state
- **Add "Sync Contacts" button**: Small refresh icon next to "All Contacts" header — triggers native picker again, merges new contacts with existing, saves to store
- Keep all existing contact display UI (ContactRow, color-coded avatars, search/filter)

### 3. Update `src/lib/permissions.ts` — `requestContacts()`
- No structural change needed — the function already returns picked contacts
- The key change is in SendMoneyFlow: stop auto-calling `requestContacts()` on mount when cached as "granted"

## Files Changed
- **New**: `src/lib/contactStore.ts` — localStorage persistence for imported contacts
- **Edit**: `src/components/SendMoneyFlow.tsx` — load from store on mount, save on import, add sync button

