

## Phase 5 — Order Detail & Tracking + Saved Addresses

### Current Gaps
- `CustomerOrdersPage` shows a flat list with no detail view — customers can't see items, shipping info, or tracking timeline
- No order detail page exists anywhere in the app
- `delivery_addresses` table exists but no UI to manage saved addresses
- ShopFlow checkout collects address inline but doesn't save/reuse addresses
- `order_items` table is populated but never displayed to customers
- No order status timeline (just a badge)

### What We'll Build

**A. Order Detail Page** (`src/pages/OrderDetailPage.tsx`)
- New route: `/orders/:id`
- Sections: order header (num, date, status badge), **status timeline** (vertical stepper showing processing → confirmed → shipped → out_for_delivery → delivered with timestamps), item list (from `order_items` with images), shipping info, payment summary (subtotal, coupon discount, delivery fee, total), escrow status indicator
- "Rate & Review" button for delivered orders (reuse existing `WriteReviewForm`)
- Real-time status updates via existing `useOrderNotifications` hook
- "Cancel Order" button visible only for `processing` status (calls `cancel_order_escrow` RPC)

**B. Update CustomerOrdersPage**
- Make each order card clickable → navigates to `/orders/:id`
- Add order count badge in header

**C. Saved Delivery Addresses** (`src/components/shop/AddressManager.tsx`)
- CRUD for `delivery_addresses` table
- List saved addresses with default indicator
- Add/edit form: label, recipient_name, phone, address_line, city, area, postal_code
- Set default toggle
- Integrate into ShopFlow checkout: show saved address picker before manual entry, option to save new address

**D. Order Status Notification to DB**
- Add a trigger on `orders` table that inserts into `notifications` when status changes (order_status_change category)
- This ensures in-app notification center shows order updates even when user wasn't online

### Files

| Action | File |
|--------|------|
| Create | `src/pages/OrderDetailPage.tsx` |
| Create | `src/components/shop/AddressManager.tsx` |
| Migration | Trigger: `notify_order_status_change` on orders UPDATE |
| Modify | `src/pages/CustomerOrdersPage.tsx` — clickable cards |
| Modify | `src/components/ShopFlow.tsx` — address picker integration |
| Modify | `src/App.tsx` — add `/orders/:id` route |

### Implementation Order
1. Order Detail Page + route
2. CustomerOrdersPage clickable navigation
3. AddressManager + ShopFlow integration
4. Order notification trigger migration

