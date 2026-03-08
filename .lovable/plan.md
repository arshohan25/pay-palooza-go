

## Plan: Merchant Account Application System

### Problem
There is no way for users to request/apply for a merchant account. Merchants can only exist if manually created by an admin.

### Solution
Add a merchant application flow: users submit a request, admins review and approve/reject from the Merchant Management panel.

### Database Changes (1 migration)

Create a `merchant_applications` table:
```sql
CREATE TABLE public.merchant_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_name text NOT NULL,
  category text NOT NULL DEFAULT 'retail',
  trade_license text,
  bank_name text,
  bank_account_number text,
  bank_routing text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.merchant_applications ENABLE ROW LEVEL SECURITY;

-- Validation trigger for status
CREATE OR REPLACE FUNCTION validate_merchant_application_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_merchant_app_status
  BEFORE INSERT OR UPDATE ON merchant_applications
  FOR EACH ROW EXECUTE FUNCTION validate_merchant_application_status();

-- RLS: Users manage own, admins manage all
CREATE POLICY "Users view own applications" ON merchant_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users create applications" ON merchant_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage applications" ON merchant_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

### Frontend Changes

**1. User-facing: "Become a Merchant" option in Account Page (`src/pages/AccountPage.tsx`)**
- Add a menu item "Become a Merchant" (visible only if user does NOT have the `merchant` role)
- Opens a sheet with an application form: business name, category, trade license, bank details, reason
- Submits to `merchant_applications` table
- Shows application status if one already exists (pending/approved/rejected)

**2. Admin-facing: Application review in `src/components/admin/AdminMerchantManagement.tsx`**
- Add a third sub-tab "Applications" alongside "Merchants" and "API Requests"
- Lists all merchant applications with status filters
- Approve action: creates the merchant record + inserts `merchant` role into `user_roles` + updates application status
- Reject action: updates status with admin notes + sends notification

### Flow
1. User goes to Account → "Become a Merchant" → fills form → submits
2. Admin sees pending application in Merchant Management → Applications tab
3. Admin approves → merchant record created, role assigned, user can access `/merchant`
4. User gets notification of approval/rejection

