

## Remove Postal Code from Address Manager

### Changes — `src/components/shop/AddressManager.tsx`

1. Remove `postal_code` from the `SavedAddress` interface (line 19)
2. Remove `postal_code` from the `form` state initialization (line 36)
3. Remove `postal_code` from `openEdit` mappings (lines 54, 58)
4. Remove `postal_code` from `handleSave` insert/update payloads (lines 75, 83)
5. Remove the Postal Code form field (the `<div>` with Label "Postal Code" and its Input, around line 220)

No database migration needed — the column can remain nullable in the table.

