# Record All Loan Steps in Transaction History

## Problem

When admin approves, disburses, or marks a loan as repaid, no transaction records are created and no balance updates happen. The loan lifecycle is invisible in the user's transaction history.

## Solution

Create server-side RPCs for each loan lifecycle step that atomically update the loan status, user balance, and insert transaction records.

### 1. Database Migration — 3 new RPCs

`**disburse_loan(p_loan_id, p_admin_id)**`

- Validates loan is in "approved" status
- Updates loan to "disbursed"
- Adds loan amount to user's balance
- Inserts transaction: type="Disbursement", description="Qard Hasan Disbursement", reference=loan ID

`**repay_loan(p_loan_id)**`  

- Validates loan is in "disbursed" status
- Calculates total payable (amount + service fee)
- Deducts total from user's balance (fails if insufficient)
- Updates loan to "repaid"
- Inserts transaction: type="payment", description="Qard Hasan Repayment", reference=loan ID

`**apply_loan(p_amount, p_tenure_days, p_interest_rate, p_emi_amount)**`

- Creates loan_application record
- Inserts transaction: type="payment", amount=0, description="Loan Application Submitted", reference=loan ID, status="pending"

### 2. Update Admin Loan Management (`AdminLoanManagement.tsx`)

- Replace direct `.update()` calls for "disburse" and "repaid" actions with RPC calls (`disburse_loan`, `repay_loan`)
- Keep approve/reject as simple status updates (no balance change needed), but also record a transaction for visibility

### 3. Update User Loan Page (`LoanPage.tsx`)

- Replace direct `.insert()` in `handleConfirmLoan` with `apply_loan` RPC call
- This ensures the application itself appears in transaction history

### Result

Every loan lifecycle event (Applied → Approved → Disbursed → Repaid / Rejected) creates a transaction record visible in the user's history with proper descriptions and references.