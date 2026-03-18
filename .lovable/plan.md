

## Add Address Management to Checkout

The checkout page currently loads saved addresses but has no way to add, edit, or save new addresses inline. If a user has no addresses, they see a dead-end "add from account settings" message.

### Solution

Integrate the existing `AddressManager` component directly into the checkout page. This component already supports add, edit, delete, and selection with a bottom-sheet form.

### Changes

**`src/pages/ShopCheckoutPage.tsx`**
- Import `AddressManager` from `@/components/shop/AddressManager`
- Replace the current manual address list + "no addresses" dead-end with `<AddressManager>` component
- Pass `userId`, `onSelect` (to set selected address), `selectedId`, and `compact` props
- Remove the manual address fetching logic (lines 86-108) and inline address picker UI (lines 298-370) — let `AddressManager` handle everything
- Keep the `selectedAddress` state by receiving callbacks from `AddressManager.onSelect`
- The `AddressManager` already provides: add new address button, edit/delete, label chips, default toggle, and bottom-sheet form

### Result
- Users can add a new shipping address directly during checkout
- Users can edit existing addresses inline
- Users can select from saved addresses
- Default address auto-selected on load
- No more dead-end when no addresses exist

