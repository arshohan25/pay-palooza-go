

## Plan: Phone Contact Search Suggestions in Send Money

### Problem
Currently, typing a name in the recipient field only filters recent transaction contacts. The user wants name-based input to also suggest matches from the device's phone contacts.

### Approach
The Contact Picker API requires a user gesture and cannot be queried in the background. So we'll add a **"Search from Contacts"** button that appears when the user types a name (non-numeric text that doesn't match a phone/wallet pattern). Tapping it opens the native contact picker. Selected contacts are merged into the suggestions list and persist for the session.

### Changes — `src/components/SendMoneyFlow.tsx`

**1. Add state for phone-picked contacts**
```tsx
const [phoneContacts, setPhoneContacts] = useState<Contact[]>([]);
```

**2. Add contact picker handler**
When the user picks contacts from the native picker, convert them to `Contact` objects and merge (deduplicate by phone) into `phoneContacts` state.

**3. Update `filteredContacts` to include phone contacts**
Merge `recentContacts` and `phoneContacts` (deduplicated), then filter by the search query.

**4. Show "Search from Contacts" button**
Below the input field, when the user has typed text that is not a phone number or wallet ID (i.e., a name search), show a `PermissionGate`-wrapped button: `📱 Find in Contacts`. Tapping it opens the native contact picker with `multiple: true`. Selected contacts are added to `phoneContacts` and immediately filtered/displayed.

**5. Update `handleContinue`**
Also search `phoneContacts` when resolving the selected recipient.

### UI Placement
- The "Find in Contacts" button appears as a subtle outlined pill below the type badge area, only when input looks like a name (no digits or too short for phone).
- Selected phone contacts appear in the same contact list alongside recent recipients, labeled with a subtle "From Contacts" badge.

### Files Modified
- `src/components/SendMoneyFlow.tsx`

