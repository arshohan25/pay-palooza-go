

## Remove Merchant Store Name from Shop Product Cards

### Change
Remove the vendor/store name row (lines 81-89) from `src/components/shop/ProductCard.tsx`. This removes the `Store` icon + store name button that appears above each product title on the shop homepage.

### File Modified
- **`src/components/shop/ProductCard.tsx`**: Delete the vendor name block (lines 81-89). Also remove the unused `Store` import from lucide-react.

Single-file, ~10-line deletion. No database changes.

