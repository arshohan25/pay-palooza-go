

## Platform Announcements / Maintenance Banner System

### Overview
Create a persistent announcement banner system that admins can manage from the dashboard, and all users see across the app (home, agent, merchant, distributor pages).

### Database
New `platform_announcements` table:
```sql
CREATE TABLE public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',        -- info, warning, maintenance, success
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,       -- higher = shown first
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz,                       -- null = no expiry
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins manage announcements" ON public.platform_announcements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can read active announcements
CREATE POLICY "Users read active announcements" ON public.platform_announcements
  FOR SELECT TO authenticated
  USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));
```

### New Components

**1. `src/components/admin/AdminAnnouncementManager.tsx`**
- CRUD interface: create/edit/delete announcements
- Fields: title, message, type (info/warning/maintenance/success), priority, starts_at, ends_at
- Toggle active/inactive
- List with status badges and type indicators

**2. `src/components/PlatformBanner.tsx`**
- Fetches active announcements from `platform_announcements`
- Renders a dismissible banner at top of page (dismiss stored in sessionStorage so it reappears next session)
- Color-coded by type: info=blue, warning=amber, maintenance=orange, success=green
- Shows highest priority first, stacks if multiple

### Wiring

| File | Change |
|------|--------|
| `src/pages/AdminDashboard.tsx` | Add `announcements` nav item to Marketing group, import + render `AdminAnnouncementManager` |
| `src/pages/Index.tsx` | Add `<PlatformBanner />` above main content |
| `src/App.tsx` | No changes needed — banner is per-page |

### Files Changed

| File | Action |
|------|--------|
| `src/components/admin/AdminAnnouncementManager.tsx` | **Create** |
| `src/components/PlatformBanner.tsx` | **Create** |
| `src/pages/AdminDashboard.tsx` | **Edit** — add nav + render block |
| `src/pages/Index.tsx` | **Edit** — add banner |
| DB migration | Create `platform_announcements` table |

