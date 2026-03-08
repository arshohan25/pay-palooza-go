## Plan: Dynamic Merchant Categories (100+ with custom additions)

### Problem

Categories are hardcoded to ~25 items across multiple files. Users cannot add custom categories, and the list is too short.

### Solution

1. Create a `merchant_categories` database table so categories are dynamic and admin-manageable
2. Seed it with 100+ categories
3. Update all 3 components to fetch categories from the database instead of hardcoded arrays
4. Allow admins to add new categories from the merchant management panel
5. Allow users to type a custom category in the application form (with a combobox/searchable input)

### Database Changes (1 migration)

**Create `merchant_categories` table + seed 100+ categories:**

```sql
CREATE TABLE public.merchant_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  label text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE merchant_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read, admins can manage
CREATE POLICY "Anyone can read categories" ON merchant_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage categories" ON merchant_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed 100+ categories
INSERT INTO merchant_categories (name, label) VALUES
  ('retail', 'Retail'), ('food', 'Food & Beverage'), ('ecommerce', 'E-Commerce'),
  ('services', 'Services'), ('healthcare', 'Healthcare'), ('education', 'Education'),
  ... (100+ rows covering industries like Fintech, Insurance, Legal, Mining, Textiles, etc.)
```

### Frontend Changes


| File                                                 | Change                                                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/hooks/use-merchant-categories.ts`               | **New** — shared hook to fetch categories from DB with caching                                             |
| `src/components/MerchantApplicationFlow.tsx`         | Replace hardcoded `CATEGORIES` with hook; use searchable combobox; add "Other" option with free-text input |
| `src/components/admin/AdminMerchantManagement.tsx`   | Replace hardcoded `CATEGORIES` with hook; add "Add Category" button in create merchant form                |
| `src/components/admin/AdminMerchantApplications.tsx` | Use hook for category display labels                                                                       |


### Key Details

- The combobox allows users to search through 100+ categories efficiently
- "Other" option lets users type a custom category name which gets stored as-is
- Admins get an "Add Category" button that inserts new categories into the DB table
- All components share the same hook so categories stay in sync

include from field owner name/ NID no, contact, emailaddress, license, branch, account-holder name etc.