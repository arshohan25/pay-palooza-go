

## Phase 4: Services & E-Commerce — Full CRUD

### Current State & Gaps

| Section | Has | Missing |
|---------|-----|---------|
| **Loans** | Approve/Reject/Disburse/Repaid workflow | Create loan offer, edit terms, delete application, audit logging |
| **Insurance** | Cancel policy | Create policy, edit coverage/premium, delete, audit logging |
| **Gift Cards** | Revoke card, detail sheet | Issue new card, edit denomination, bulk generate, delete, audit logging |
| **Savings** | Read-only user summaries + detail sheet | Edit/close goals, toggle auto-saves, delete goals, audit logging |
| **Donations** | Read-only fund list | Create/edit/delete causes, disburse funds, audit logging |
| **E-Commerce Hub** | Products CRUD, store toggle, 12 sub-tabs | Already robust — no changes needed |

### Implementation

**File 1: `AdminLoanManagement.tsx`**
- Add "Create Loan Offer" dialog (select user by phone, amount, tenure, interest rate, EMI)
- Add "Edit Terms" button on pending/approved loans (inline edit amount, rate, tenure)
- Add "Delete" button with AlertDialog confirmation for any status
- Add audit logging to all actions (approve/reject/disburse/repaid/create/delete)

**File 2: `AdminInsuranceManagement.tsx`**
- Add "Create Policy" dialog (user phone, plan name, type, premium, coverage, duration months)
- Add "Edit" button per row (edit premium, coverage_amount, duration_months, expires_at)
- Add "Delete" button with AlertDialog for cancelled/expired policies
- Add audit logging to cancel/create/edit/delete

**File 3: `AdminGiftCardManagement.tsx`**
- Add "Issue Card" dialog (brand, denomination, recipient phone, auto-generate code)
- Add "Bulk Generate" dialog (brand, denomination, count — generates N cards)
- Add "Edit" on active cards (change denomination, brand)
- Add "Delete" button for expired/redeemed cards
- Add audit logging

**File 4: `AdminSavingsManagement.tsx`**
- In user detail sheet: Add "Close Goal" button (returns saved amount to wallet)
- Add "Edit Goal" (target amount, name)
- Add "Toggle Auto-Save" (pause/resume)
- Add "Delete Goal" with confirmation
- Add audit logging

**File 5: `AdminDonationFunds.tsx`**
- Add "Create Cause" dialog (cause_name, cause_icon, initial balance)
- Add inline edit per row (cause_name, cause_icon)
- Add "Delete Cause" with confirmation (only if balance is 0)
- Add "Disburse" button to withdraw funds from a cause (with reason + audit)
- Add audit logging

### Technical Pattern (consistent across all files)
- Every mutation: `audit_logs` insert with actor_id, action, entity_type, entity_id, details
- Every destructive action: AlertDialog confirmation
- Toast feedback on success/error
- List auto-refresh after mutation

### Files Modified
1. `src/components/admin/AdminLoanManagement.tsx`
2. `src/components/admin/AdminInsuranceManagement.tsx`
3. `src/components/admin/AdminGiftCardManagement.tsx`
4. `src/components/admin/AdminSavingsManagement.tsx`
5. `src/components/admin/AdminDonationFunds.tsx`

### Database Changes
None — all tables exist with required columns.

