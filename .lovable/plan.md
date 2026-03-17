

## E-Commerce Buyer Flow — Gap Analysis & Fix Plan

### What's Working
- **Homepage → Shop**: "Shop" button correctly navigates to `/shop`
- **Shop Page** (`/shop`): Product listing, search, filters, sort, categories, AI recommendations — all connected to DB
- **Product Detail** (`/product/:id`): Loads from DB, shows variants, reviews, vendor links — works
- **Vendor Stores** (`/shop/:slug`): Individual vendor storefront pages — connected
- **Wishlist** (`/wishlist`): Connected via `useWishlist` hook
- **Orders** (`/orders`, `/orders/:id`): Customer order list and detail with status timeline — connected
- **Product Cards**: Navigate to product detail, vendor store links work
- **Add to Cart**: Works from both ShopPage and ProductDetailPage via shared `useCart` hook (localStorage)

### Critical Gap Found: No Checkout Flow from Cart

The **"Proceed to Checkout"** button in the `CartDrawer` currently does this:
```typescript
onCheckout={() => { setCartOpen(false); navigate("/"); }}
```
It just closes the cart and goes home. **There is no checkout page or flow accessible from the `/shop` page's cart.**

The full checkout logic (address selection, coupon application, PIN verification, wallet payment, `place_shop_order` RPC call) lives entirely inside `ShopFlow.tsx` — a self-contained bottom-sheet component that is **no longer rendered anywhere** (it was removed from Index.tsx when we switched to `navigate("/shop")`).

### What Needs to Be Built

**Create a standalone Checkout Page** (`/shop/checkout`) that extracts the checkout logic from `ShopFlow` and works with the shared `useCart` hook:

| Action | File | Description |
|--------|------|-------------|
| Create | `src/pages/ShopCheckoutPage.tsx` | Standalone checkout page with: address picker (saved addresses from DB + manual entry), order summary with item list, coupon code input (calls `validate_and_apply_coupon` RPC), delivery fee display, wallet balance check, PIN entry, `place_shop_order` RPC call, success screen with order number, "View Order" link to `/orders/:id` |
| Modify | `src/App.tsx` | Add route `/shop/checkout` |
| Modify | `src/pages/ShopPage.tsx` | Change cart `onCheckout` from `navigate("/")` to `navigate("/shop/checkout")` |
| Modify | `src/pages/ProductDetailPage.tsx` | Add "Buy Now" button that adds to cart and navigates to `/shop/checkout` |
| Modify | `src/components/shop/CartDrawer.tsx` | Update to accept a checkout navigation path or use `useNavigate` internally |

### Checkout Page Design
The page will reuse patterns from `ShopFlow.tsx` checkout screen:
1. **Order Summary** — items from `useCart` hook, grouped by vendor, with quantities/prices
2. **Saved Address Picker** — queries `delivery_addresses` table (reuse `AddressManager` component), option to add new
3. **Coupon Code** — input field calling `validate_and_apply_coupon` RPC
4. **Payment Summary** — subtotal, discount, delivery fee, total
5. **Payment Method** — wallet (shows balance) or card placeholder
6. **PIN Confirmation** — 4-digit PIN via `verifyPin()`
7. **Place Order** — calls `place_shop_order` RPC, clears cart, shows success
8. **Success View** — order number, "View Order" button → `/orders/:id`, "Continue Shopping" → `/shop`

### Implementation Order
1. Create `ShopCheckoutPage.tsx` with full checkout flow
2. Add route and update navigation in ShopPage, ProductDetailPage, CartDrawer

