

# Fix: Contacts Not Displaying in Send Money & Recharge

## Problem
Both Send Money and Mobile Recharge flows show empty contact lists because:
1. The Contact Picker API (`navigator.contacts`) is not supported in most browsers
2. No stored contacts exist in localStorage
3. No prior transactions exist to populate "Recent" contacts

bKash/Nagad/Upay native apps always show contacts because they have native access. In a web app, we need a different approach.

## Solution
Add **seed/demo contacts** that always appear when no real contacts are available, giving the UI a populated look like bKash/Nagad. These will be clearly marked and serve as both demo data and quick-access shortcuts.

### 1. Add seed contacts to `contactStore.ts`
Create a `getSeedContacts()` function that returns a set of sample Bangladeshi contacts (e.g., "Rahim Uddin", "Fatima Akter", etc.) when no real contacts exist in localStorage. These give the UI a populated bKash-like feel.

### 2. Update `SendMoneyFlow.tsx` — show seed contacts as fallback
- In the `useEffect` that loads contacts, if `loadStoredContacts()` returns empty, fall back to `getSeedContacts()`
- Show seed contacts in the "All Contacts" section so the list is never empty
- Keep the "Allow Contact Access" card at the bottom for users to import real contacts

### 3. Update `MobileRechargeFlow.tsx` — same seed contact fallback
- Apply the same pattern: if `loadContacts()` returns empty, use seed contacts
- Show them in the contact list below the phone input

### 4. Visual treatment
- Seed contacts render identically to real contacts (colored avatar + initials + name + phone)
- When a user taps a seed contact, the phone number populates the input field normally
- Once the user syncs real contacts, seeds are replaced

## Files Changed
- `src/lib/contactStore.ts` — Add `getSeedContacts()` function with sample data
- `src/components/SendMoneyFlow.tsx` — Use seed contacts when no stored contacts exist
- `src/components/MobileRechargeFlow.tsx` — Same seed contact fallback

