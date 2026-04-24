# Phase 1 — Vendor Lifecycle & Earnings (Multi-Vendor E-commerce)

Based on your answers:
- **Withdrawal**: EasyPay wallet only (vendor → owner's wallet credit)
- **Commission**: Flat % per vendor + per-category override
- **Vendor KYC**: Both — user must be KYC-verified AND submit business docs
- **Approvals**: All withdrawals manually reviewed by admin

## What already exists (will be extended, not duplicated)
- `merchants` table (business_name, trade_license, bank fields, mdr_rate, status enum)
- `vendor_stores` (slug, logo, banner, rating)
- `merchant_payouts` (basic shell with status/admin_note/reviewed_by)
- `commission_tiers` (currently MFS-focused — agent/distributor splits)
- `merchant_applications` (current onboarding entry point)
- `AdminEcommerceHub.tsx` (admin shell)

## Database changes (one migration)

**1. Extend `merchants` for commission overrides + KYC tracking**
```sql
ALTER TABLE merchants
  ADD COLUMN commission_rate numeric DEFAULT 5.00,         -- flat % default
  ADD COLUMN business_kyc_status text DEFAULT 'pending',   -- pending|approved|rejected
  ADD COLUMN business_kyc_reviewed_by uuid,
  ADD COLUMN business_kyc_reviewed_at timestamptz,
  ADD COLUMN business_kyc_rejection_reason text,
  ADD COLUMN nid_front_url text,
  ADD COLUMN nid_back_url text,
  ADD COLUMN trade_license_url text,
  ADD COLUMN bank_statement_url text;
```

**2. New `vendor_commission_overrides` table** (per-category exceptions)
```sql
CREATE TABLE vendor_commission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES merchants(id) ON DELETE CASCADE,
  category text NOT NULL,                -- matches product category
  commission_rate numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(merchant_id, category)
);
```

**3. New `vendor_wallets` table** (separate ledger, not user wallet)
```sql
CREATE TABLE vendor_wallets (
  merchant_id uuid PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  available_balance numeric DEFAULT 0,    -- ready to withdraw
  pending_balance numeric DEFAULT 0,      -- in escrow until order delivered
  lifetime_earnings numeric DEFAULT 0,
  lifetime_withdrawn numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
```

**4. New `vendor_earnings_ledger` table** (audit trail)
```sql
CREATE TABLE vendor_earnings_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES merchants(id),
  order_id uuid,
  gross_amount numeric NOT NULL,
  commission_rate numeric NOT NULL,
  commission_amount numeric NOT NULL,
  net_amount numeric NOT NULL,            -- credited to vendor
  status text DEFAULT 'pending',          -- pending|released|refunded
  released_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

**5. Extend `merchant_payouts`** (EasyPay-only flow)
```sql
ALTER TABLE merchant_payouts
  ADD COLUMN payout_method text DEFAULT 'easypay_wallet',
  ADD COLUMN destination_user_id uuid,    -- owner's user_id for wallet credit
  ADD COLUMN credited_txn_id uuid;        -- link to transactions row when paid
```

**6. RPCs (SECURITY DEFINER)**
- `submit_business_kyc(p_business_name, p_trade_license, p_nid_front, p_nid_back, p_bank_statement, p_category)` — checks user KYC verified, creates merchant in `pending` status
- `approve_business_kyc(p_merchant_id, p_commission_rate)` — admin only; flips to `approved`, creates vendor_wallet row, creates default vendor_store
- `reject_business_kyc(p_merchant_id, p_reason)` — admin only
- `request_vendor_payout(p_amount)` — vendor RPC; checks `available_balance >= amount`, deducts, creates payout row in `pending`
- `approve_vendor_payout(p_payout_id, p_note)` — admin RPC; credits owner's user wallet + writes a `transactions` row + marks payout `paid`
- `reject_vendor_payout(p_payout_id, p_reason)` — refunds amount back to `available_balance`
- `get_effective_commission_rate(p_merchant_id, p_category)` — returns override if exists, else merchant default

**7. RLS policies** for all new tables (vendor sees only own rows; admins via `has_role`)

## Frontend changes

**New components**
- `src/components/MerchantBusinessKycFlow.tsx` — multi-step business KYC submission (replaces parts of MerchantApplicationFlow)
- `src/components/admin/AdminVendorKycReview.tsx` — admin queue for business KYC approvals with doc viewer + commission rate input
- `src/components/admin/AdminVendorCommissionManager.tsx` — set per-vendor flat rate + add category overrides
- `src/components/admin/AdminVendorPayouts.tsx` — payout approval queue (replaces basic `MerchantPayoutsTab` admin view)
- `src/components/merchant/VendorWalletCard.tsx` — shows available/pending/lifetime balances inside merchant dashboard
- `src/components/merchant/VendorWithdrawalFlow.tsx` — vendor withdrawal request UI (PIN-protected, EasyPay wallet destination)
- `src/components/merchant/VendorEarningsLedger.tsx` — order-by-order earnings history

**Edits**
- `src/components/admin/AdminEcommerceHub.tsx` — add tabs: "Vendor KYC", "Commissions", "Payouts"
- `src/pages/MerchantDashboard.tsx` — surface VendorWalletCard + Earnings/Withdraw entry
- `src/components/MerchantApplicationFlow.tsx` — extend to collect NID front/back + bank statement uploads (Supabase Storage bucket `vendor-kyc`)
- `place_shop_order` RPC (existing) — on order completion, write to `vendor_earnings_ledger` (pending) and increment `vendor_wallets.pending_balance`
- Order delivery confirmation flow — release pending → available + bump `lifetime_earnings`

**Storage**
- New bucket `vendor-kyc` (private, vendor + admin read)

## Out of scope for Phase 1 (saved for later phases)
- Product variants matrix
- Bulk CSV uploads
- Referral system
- Abandoned cart recovery
- Courier webhooks
- AI tools

## Files touched (estimate)
~12 files: 1 migration, 7 new components, 4 edits.

---

**Ready to implement?** Approve and I'll start with the migration, then build top-down (admin review queue → vendor wallet → withdrawal flow).