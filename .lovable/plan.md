

## Plan: Comprehensive Admin Merchant Management System

### Current State
The admin dashboard has only a minimal merchant sub-tab under "Users" — a basic table with business name, category, status, and suspend/lock buttons. There's no dedicated merchant management section, no detail views, no onboarding workflow, no per-merchant fee configuration, no settlement oversight, and no API key administration.

### What We'll Build

**1. Dedicated "Merchants" nav tab in Admin Dashboard** (replacing the sub-tab under Users)
- Full-featured merchant list with search, filters (status, category), and bulk actions
- Sortable columns: Business Name, Owner, Phone, Category, Status, MDR Rate, Revenue, Created

**2. Merchant Detail Sheet** (click any merchant row)
- **Profile tab**: Business info, owner profile, bank details, trade license, QR code
- **Transactions tab**: All transactions for this merchant with filters
- **API Keys tab**: View/revoke merchant API keys, see webhook URLs, payment session logs
- **Limits tab**: View/edit merchant-specific limit overrides (reuse existing MerchantLimitsTab logic)
- **Settings tab**: Edit MDR rate, settlement frequency, category, bank details

**3. Merchant Onboarding/Approval Workflow**
- Pending merchants shown with highlighted badge and "Review" button
- Approval dialog: view submitted docs (trade license, NID), approve or reject with notes
- Auto-notify merchant on status change (via notifications table)

**4. Per-Merchant Fee/MDR Configuration**
- Inline editor to set custom MDR rate per merchant
- Override settlement frequency (T+0, T+1, T+2)

**5. Merchant Analytics Summary**
- Total revenue, transaction count, average ticket size per merchant
- Top merchants by revenue (leaderboard card)

**6. Bulk Actions**
- Bulk approve pending merchants
- Bulk suspend/activate
- Export merchants CSV

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/admin/AdminMerchantManagement.tsx` | New — full merchant management component |
| `src/pages/AdminDashboard.tsx` | Add "merchants" nav item + wire component |
| `src/hooks/use-admin.ts` | Add merchant detail fetch, approval, MDR update helpers |

### No Database Changes Needed
The existing `merchants`, `merchant_api_keys`, `merchant_payment_sessions`, `profiles`, `transactions`, and `notifications` tables already have the columns and RLS policies needed. Admin has full access via `has_role(auth.uid(), 'admin')` policies.

