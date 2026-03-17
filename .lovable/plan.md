

## Courier Providers, Delivery Fees & Career Page

No courier/shipping provider management, zone-based delivery fees, or career/jobs page currently exists. Here's the plan:

---

### 1. Database — New Tables

**`courier_providers`** — Admin-managed list of courier companies
```sql
CREATE TABLE public.courier_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,              -- e.g. Pathao, Steadfast, RedX, Sundarban
  logo_url text,
  tracking_url_template text,      -- e.g. https://pathao.com/track/{tracking_id}
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

**`delivery_zones`** — Zone-based delivery fee configuration
```sql
CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name text NOT NULL,         -- e.g. "Dhaka City", "Outside Dhaka"
  cities text[] NOT NULL,          -- e.g. {"Dhaka","Gazipur","Narayanganj"}
  delivery_fee numeric NOT NULL DEFAULT 0,
  estimated_days text DEFAULT '3-5 days',
  courier_provider_id uuid REFERENCES courier_providers(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

**`job_listings`** — Career/jobs page
```sql
CREATE TABLE public.job_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text,                 -- e.g. Engineering, Operations, Agent Network
  location text DEFAULT 'Bangladesh',
  type text DEFAULT 'full-time',   -- full-time, part-time, contract
  description text,
  requirements text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES job_listings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  applicant_name text NOT NULL,
  applicant_phone text NOT NULL,
  applicant_email text,
  resume_url text,
  cover_note text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
```

RLS: Admins manage all 4 tables. Public can view active couriers, zones, and job listings. Authenticated users can insert job applications.

---

### 2. Checkout — Dynamic Delivery Fee

**`src/pages/ShopCheckoutPage.tsx`**:
- Fetch `delivery_zones` on load
- Match `selectedAddress.city` to a zone's `cities` array
- Display matched zone name, courier, estimated days, and fee (replace hardcoded `FREE` / `p_delivery_fee: 0`)
- Pass real fee to `place_shop_order` RPC

---

### 3. Admin — Courier & Delivery Management

Add two new sub-tabs to **`AdminEcommerceHub.tsx`**:
- **"Couriers"** tab — CRUD for courier providers (name, logo, tracking URL, active toggle)
- **"Delivery Zones"** tab — CRUD for zones (zone name, cities multi-input, fee, estimated days, linked courier)

**New files:**
- `src/components/admin/AdminCourierProviders.tsx`
- `src/components/admin/AdminDeliveryZones.tsx`

---

### 4. Career Page

**New file: `src/pages/CareersPage.tsx`**
- Lists active job openings from `job_listings`
- Each card shows title, department, location, type
- Clicking opens a detail sheet with description, requirements, and an "Apply" form (name, phone, email, optional resume upload, cover note)
- Applications saved to `job_applications`

**Route**: Add `/careers` to App.tsx router.

**Navigation**: Add a "Careers" link in the account/more menu.

---

### 5. Admin — Job Management

Add to AdminDashboard a new **"Careers"** section or sub-tab:
- View all job listings with CRUD
- View applications per job with status management (pending → shortlisted → rejected)

**New file:** `src/components/admin/AdminCareersManager.tsx`

---

### Files Summary

| Action | File |
|--------|------|
| Create | `src/components/admin/AdminCourierProviders.tsx` |
| Create | `src/components/admin/AdminDeliveryZones.tsx` |
| Create | `src/components/admin/AdminCareersManager.tsx` |
| Create | `src/pages/CareersPage.tsx` |
| Modify | `src/pages/ShopCheckoutPage.tsx` — dynamic delivery fee |
| Modify | `src/components/admin/AdminEcommerceHub.tsx` — add Couriers & Zones tabs |
| Modify | `src/pages/AdminDashboard.tsx` — add Careers section |
| Modify | `src/App.tsx` — add `/careers` route |
| Modify | `src/components/MoreSheet.tsx` or Account page — add Careers link |
| Migration | Create 4 tables + RLS policies |

