

## Plan: Merchant API Request System

### Overview
Merchants currently generate API keys directly. This plan changes the flow so merchants can only **request** API access, and admins **approve/reject** requests and manage all API keys from the admin panel.

### Database Changes (1 migration)

Create a `merchant_api_requests` table:
```sql
CREATE TABLE public.merchant_api_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES merchants(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  webhook_url text,
  reason text,
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.merchant_api_requests ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own requests and insert new ones
CREATE POLICY "Merchants view own requests" ON merchant_api_requests FOR SELECT TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));
CREATE POLICY "Merchants create requests" ON merchant_api_requests FOR INSERT TO authenticated
  WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));
-- Admins full access
CREATE POLICY "Admins manage requests" ON merchant_api_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

### Frontend Changes

**1. `src/components/MerchantApiTab.tsx`** — Replace key generation with request system:
- Remove `generateKey()` and `revokeKey()` functions
- Add "Request API Access" button that inserts into `merchant_api_requests`
- Show request status (pending/approved/rejected) with appropriate badges
- Keep read-only display of existing API keys (no generate/revoke buttons)
- Keep webhook URL editing on existing keys
- Keep integration guide docs and payment session list unchanged

**2. `src/components/admin/AdminMerchantManagement.tsx`** — Add API key management to admin:
- Add "Generate Key" button in the API Keys tab of merchant detail sheet
- Add ability to approve/reject requests from a new requests section
- Generate key logic moved here (same `epk_`/`eps_` pattern)
- Admin can revoke keys (already exists), generate new ones, and review requests

### Key Behavior
- Merchant sees: request button, request status, read-only keys, docs, sessions
- Admin sees: pending requests queue, generate/revoke keys, full management
- When admin approves a request, a key is auto-generated and request status updated

