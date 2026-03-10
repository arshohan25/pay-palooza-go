# Admin Notification Center — Send Role-Based Notifications

## What We're Building

An admin notification management module ("Notify" tab) in the Admin Dashboard that lets admins compose and broadcast notifications to users filtered by role. Each user sees these in their existing notification center, with a clickable popup card showing full details linkable with selected features.

## Database Changes

**New table: `admin_notifications**` — tracks broadcast notifications sent by admin:

- `id` (uuid, PK)
- `admin_id` (uuid, references auth.users)
- `title` (text)
- `body` (text)
- `category` (text) — promo, update, offer, coupon, system, cashback
- `target_roles` (text[]) — which roles to target (customer, agent, merchant, etc.), empty = all
- target_area (text) - dhaka, khulna, chittagong, barishal, cumilla, rajshahi
- terget_user (text) - transaction are high, transaction are low, inactive, morethan 10, 20, 50, 80, 100 transactions
- `metadata` (jsonb) — optional extra data (coupon code, image URL, action URL, etc.)
- `sent_count` (int, default 0)
- `created_at` (timestamptz)

RLS: admin-only insert/select/update.

**No schema change to `notifications**` — we insert rows into the existing `notifications` table for each targeted user via a backend function.

**New edge function: `send-admin-notification**` — receives title, body, category, target_roles, metadata. Queries `user_roles` to find matching user IDs, batch-inserts into `notifications` table, records in `admin_notifications`.

## Frontend Changes

### 1. New Admin Tab: "Notify" (with Bell icon)

Add to `NAV_ITEMS` in `AdminDashboard.tsx`:

```
{ id: "notify", label: "Notify", icon: Bell }
```

### 2. New Component: `AdminNotificationSender.tsx`

- **Compose form**: Title, body, category dropdown (Promotion, Update, Offer, Coupon, System)
- **Role selector**: Multi-select checkboxes for target roles (All Users, Customer, Agent, Merchant, Distributor, Super Distributor)
- **Optional metadata fields**: Coupon code, image URL, action button text/URL
- **Send button**: Calls the edge function
- **History table**: Shows previously sent admin notifications with sent count, date, and category badge

### 3. Enhanced User Notification Center — Popup Card

Modify `NotificationCenter.tsx`:

- When a notification has `metadata` with rich content (category = promo/offer/coupon), clicking it opens a **detail popup card** (Dialog) instead of just marking read
- Card shows: title, full body, image (if provided), coupon code with copy button, action button (if URL provided)
- Smooth animation with the existing framer-motion setup

### 4. Edge Function: `send-admin-notification`

- Validates admin role via JWT
- Queries users by role from `user_roles` (or all profiles if "all")
- Batch inserts notifications (chunks of 100)
- Records in `admin_notifications` with sent_count
- Returns success with count

## Implementation Order

1. Create `admin_notifications` table + RLS
2. Create `send-admin-notification` edge function
3. Build `AdminNotificationSender.tsx` component
4. Add "Notify" tab to AdminDashboard
5. Enhance `NotificationCenter.tsx` with popup detail card on click