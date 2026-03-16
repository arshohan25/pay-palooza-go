

## Plan: Add Notification Logs/SMS Tracking + Marketing Campaigns

### 1. AdminNotificationSender.tsx — Add 2 New Tabs

Currently a single-view compose + history layout. Convert to a tabbed interface:

**Existing content → "Compose" tab** (default, unchanged)

**New "Notification Logs" tab:**
- Searchable table of all `notifications` table entries (not admin_notifications)
- Columns: User (phone/name from profiles), Title, Category, Read status, Created at
- Filters: date range, read/unread, search by title
- Shows delivery stats: total sent, read rate percentage
- Data source: `notifications` table (already has RLS for admin)

**New "SMS Logs" tab:**
- Table of SMS-related `audit_logs` entries (action contains 'sms' or 'otp' or 'notify')
- Columns: Recipient phone, Action type, Status (from details JSON), Timestamp
- Filter by date range, action type
- Summary cards: Total SMS sent today, OTP requests, Delivery success rate
- Data source: `audit_logs` table filtered by SMS-related actions

### 2. AdminMarketingTools.tsx — Add "Campaigns" Tab

Add a third sub-tab button alongside existing "Promo Codes" and "Cashback Rules":

**Campaigns tab features:**
- Campaign = named group with start/end dates, status (draft/active/ended), linked promo codes and cashback rules
- Create/Edit dialog: name, description, start date, end date, select promo codes (multi-select from existing), select cashback rules (multi-select from existing)
- Campaign list showing: name, date range, status badge, linked promos count, linked cashback count, total redemptions (sum of linked promo used_count)
- Toggle active/inactive, delete campaign
- No new DB table needed — store campaigns in localStorage or a lightweight JSON approach. Actually, for persistence, we need a `campaigns` table.

**Database migration needed:** `campaigns` table:
```sql
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  promo_ids uuid[] DEFAULT '{}',
  cashback_ids uuid[] DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Admin-only RLS
```

### Files Changed

| File | Action |
|------|--------|
| `src/components/admin/AdminNotificationSender.tsx` | Edit — Add tabs: Compose, Notification Logs, SMS Logs |
| `src/components/admin/AdminMarketingTools.tsx` | Edit — Add Campaigns sub-tab with CRUD |
| DB migration | Create — `campaigns` table with admin RLS |

