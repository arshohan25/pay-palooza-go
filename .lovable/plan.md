## Plan: Redesign Send Money Recipient Step

### Changes to `src/components/SendMoneyFlow.tsx`

**1. Remove "Pick from Contacts" and "Upload QR from Gallery" buttons (lines 422-460)**
Remove the entire `PermissionGate` block (Pick from Contacts) and the QR gallery upload button. The QR scan icon inside the search field remains.

**2. Limit recent contacts to 3 (line 479)**
Change `filteredContacts.map(...)` to `filteredContacts.slice(0, 3).map(...)` so only the first 3 recent contacts are displayed.

### Files Modified

- `src/components/SendMoneyFlow.tsx`

Placeholder : Name/Number or W-ID