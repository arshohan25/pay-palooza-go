

## Enhance LEA Report with Complete User Data

### What's missing from current report

The current LEA report only includes: profile basics, KYC, transactions, devices, and roles. The database has significantly more user-linked data that law enforcement would need.

### New sections to add

| # | Section | Table | Key Fields |
|---|---------|-------|------------|
| 6 | **Saved Bank Accounts** | `saved_bank_accounts` | bank_name, account_number, account_holder |
| 7 | **Fund Requests** | `fund_requests` | type, amount, bank_name, account_number, account_holder, status, proof_url |
| 8 | **Loan History** | `loan_applications` | amount, tenure, status, applied_at, repaid_amount |
| 9 | **Fraud Alerts** | `fraud_alerts` | rule_triggered, severity, status, details |
| 10 | **Disputes** | `disputes` | subject, description, status, resolution_notes |
| 11 | **Support Complaints** | `support_complaints` | complaint_number, subject, priority, status |
| 12 | **Referral Activity** | `referrals` | referrer/referee relationships, referral_code, milestones, total_rewarded |
| 13 | **Agent Profile** | `agents` | business_name, territory, NID, trade_license, commission_earned, status |
| 14 | **Merchant Profile** | `merchants` | business_name, category, bank details, trade_license, status |
| 15 | **Audit Trail** | `audit_logs` | user's own logged actions with timestamps and IP addresses |

### Additional fields to expose in existing sections

- **Account Info**: add `email`, `deactivated_at`, `scheduled_deletion_at`, `kyc_exempt`, `status_text`
- **Transactions**: add `recipient_phone`, `recipient_name`, `description`, `balance_after`, `commission`, `short_id` columns to the table

### Summary footer enhancements

Add to the bottom summary block:
- Total fees paid
- Total loans taken / repaid
- Number of fraud alerts
- Number of disputes
- Account age (days since registration)

### Technical changes

**File: `src/components/admin/AdminLEARequest.tsx`**

1. Expand the `UserReport` interface to include all new data arrays
2. Add 10 more parallel queries in `handleSearch` using `Promise.all`:
   ```ts
   supabase.from("saved_bank_accounts").select("*").eq("user_id", userId)
   supabase.from("fund_requests").select("*").eq("user_id", userId)
   supabase.from("loan_applications").select("*").eq("user_id", userId)
   supabase.from("fraud_alerts").select("*").eq("user_id", userId)
   supabase.from("disputes").select("*").eq("complainant_id", userId)
   supabase.from("support_complaints").select("*").eq("raised_by", userId)
   supabase.from("referrals").select("*").or(`referrer_id.eq.${userId},referee_id.eq.${userId}`)
   supabase.from("agents").select("*").eq("user_id", userId).maybeSingle()
   supabase.from("merchants").select("*").eq("user_id", userId).maybeSingle()
   supabase.from("audit_logs").select("*").eq("actor_id", userId).order("created_at",{ascending:false}).limit(100)
   ```
3. Add on-screen preview sections for each new data category with appropriate icons and table layouts
4. Add all new sections to the hidden printable report div for PDF generation
5. Expand transaction table columns to include recipient_phone, balance_after, short_id
6. Update summary footer with total fees, loan data, fraud count, dispute count, account age

### Files touched
- `src/components/admin/AdminLEARequest.tsx` (edit only)

