

# Show All Contacts List Like bKash After Permission Granted

## Problem
Currently, the Contact Picker API is called with `multiple: false`, so users can only pick one contact at a time. After picking, only that single contact shows in the list. The "Import from Phone Contacts" button shows as a dashed outline — not the seamless bKash-style experience where all contacts appear alphabetically after granting permission.

## Changes

### 1. Enable multi-select in Contact Picker
**File**: `src/lib/permissions.ts` (line 63)
- Change `{ multiple: false }` → `{ multiple: true }` so users can select all their contacts at once

### 2. Redesign contact list to match bKash style
**File**: `src/components/SendMoneyFlow.tsx`

**Contact row styling** (line 542-560):
- Add colored circle avatars with initials (pastel colors like bKash: green, blue, pink, yellow, teal, purple)
- Show name prominently, phone number below in muted text
- For contacts with multiple saved numbers, show a chevron-down to expand
- Remove the "Contacts" badge chip — not needed when the whole section is contacts

**"All Contacts" section header** (line 665-676):
- Change to Bengali-friendly label: "সব কন্ট্যাক্টস" / "All Contacts" matching bKash style
- Show contact count in the header

**Import button replacement** (line 698-708):
- When `phoneContacts.length === 0` AND permission is NOT yet granted: show a prominent "Allow Contact Access" card with explanation text instead of a dashed border button
- When permission is granted but no contacts loaded yet: show a loading state
- When contacts are loaded: the button is