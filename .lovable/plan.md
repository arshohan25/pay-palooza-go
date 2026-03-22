

## Add Admin Management Panels for Loans, Insurance, and Gift Cards

### Summary
Create three new admin components and register them in the Admin Dashboard navigation, plus add a missing `admin_notes` column to `loan_applications`.

### Database Migration
Add `admin_notes` column to `loan_applications` (the loan status notification trigger already references this column but it doesn't exist):

```sql
ALTER TABLE public.loan_applications ADD COLUMN admin_notes text;
```

### New Components

#### 1. `src/components/admin/AdminLoanManagement.tsx`
- Fetch all loan applications ordered by `created_at DESC`
- Show stats: total applications, pending, approved, disbursed, total amount lent
- Table with columns: User ID (truncated), Amount, Tenure, EMI, Interest Rate, Status, Applied At
- Status badge colors: pending=yellow, approved=green, rejected=red, disbursed=blue, repaid=emerald
- Actions per row:
  - **Approve** (pending → approved): adds admin_notes, sets reviewed_by/reviewed_at
  - **Reject** (pending → rejected): requires reason in admin_notes
  - **Disburse** (approved → disbursed)
  - **Mark Repaid** (disbursed → repaid)
- Search filter by user_id
- Status filter tabs (All / Pending / Approved / Rejected / Disbursed / Repaid)

#### 2. `src/components/admin/AdminInsuranceManagement.tsx`
- Fetch all insurance policies ordered by `created_at DESC`
- Stats: total policies, active, expired, total premiums collected
- Table: User ID, Plan Name, Plan Type, Premium, Coverage, Duration, Status, Expires At
- Actions: Cancel policy (active → cancelled), view details
- Filter by status, search by plan name
- Highlight policies expiring within 7 days

#### 3. `src/components/admin/AdminGiftCardManagement.tsx`
- Fetch all gift cards ordered by `created_at DESC`
- Stats: total cards, active, redeemed, total denomination value
- Table: Code (masked), Brand, Denomination, Status, Purchaser, Recipient Phone, Created
- Actions: Revoke card (active → expired), view full code in detail sheet
- Filter by status, search by code/brand

### Admin Dashboard Changes (`src/pages/AdminDashboard.tsx`)

1. Add imports for three new components
2. Add nav items under a new **"Services"** group in `NAV_GROUPS`:
   ```
   { id: "loans", label: "Loans", icon: CreditCard }
   { id: "insurance", label: "Insurance", icon: Shield }
   { id: "gift_cards", label: "Gift Cards", icon: Gift }
   ```
3. Add tab rendering:
   ```
   {activeTab === "loans" && <AdminLoanManagement />}
   {activeTab === "insurance_mgmt" && <AdminInsuranceManagement />}
   {activeTab === "gift_cards_mgmt" && <AdminGiftCardManagement />}
   ```

### Files Modified
1. **Database migration** — add `admin_notes` to `loan_applications`
2. `src/components/admin/AdminLoanManagement.tsx` — new file
3. `src/components/admin/AdminInsuranceManagement.tsx` — new file
4. `src/components/admin/AdminGiftCardManagement.tsx` — new file
5. `src/pages/AdminDashboard.tsx` — imports + nav items + tab rendering

