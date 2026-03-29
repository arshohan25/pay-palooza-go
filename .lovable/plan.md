

# Auto-Request Permissions After Login & Show Contacts in Recharge Flow

## Problem
1. Contacts are only requested when user manually taps "Allow Contact Access" inside Send Money — should be requested automatically right after login (like bKash/Nagad/Rocket)
2. Mobile Recharge flow has no contact list — just a "Pick from Contacts" button that opens native picker each time. It should show imported contacts below the number input (like the Rocket screenshot)

## Changes

### 1. Auto-request permissions after login — `src/pages/Index.tsx`
Add a `useEffect` that runs once after authentication:
- Check if contacts permission is not yet "granted" in cache
- If not, call `requestContacts()` silently — on grant, save all contacts to `contactStore`
- Also request camera permission silently (for QR scanning)
- This runs once per device (cached status prevents re-prompting)

### 2. Add contact list to Mobile Recharge — `src/components/MobileRechargeFlow.tsx`
Replicate the Rocket-style UI from the screenshot:
- Import `loadContacts` from `contactStore` and `requestContacts` from permissions
- On mount, load stored contacts into state
- Show contacts below the phone input field in the "number" step:
  - **"Recent"** section (from recent recharges if available)
  - **"Contacts"** section with all imported contacts (name + phone, with avatar initials)
- Tapping a contact fills the phone input field
- Replace the "Pick from Contacts" button with a "Sync" refresh icon in the contacts header
- Keep "Allow Contact Access" card if no contacts are stored yet (same as SendMoney pattern)

### 3. Shared contact-to-UI mapper — `src/lib/contactStore.ts`
Add a helper `mapStoredContactsToUI()` that converts `StoredContact[]` to the UI contact format with initials and color classes — avoids duplicating this logic between SendMoney and Recharge flows.

## Files Changed
- `src/pages/Index.tsx` — add post-login auto-permission request useEffect
- `src/components/MobileRechargeFlow.tsx` — add contact list UI below phone input (Rocket style)
- `src/lib/contactStore.ts` — add shared UI mapper helper

