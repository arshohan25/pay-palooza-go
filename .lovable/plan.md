

## Plan: Make Admin Dashboard Sidebar & Header Responsive for Tablet Viewports

### Problem
At tablet widths (768px–1024px), the fixed 224px sidebar is always visible, leaving only ~540-800px for content. The header search bar and controls also compete for space.

### Solution
Shift the sidebar breakpoint from `md` (768px) to `lg` (1024px). This means tablets (768–1023px) get the mobile hamburger drawer instead of the fixed sidebar, freeing up the full viewport width for content.

### Changes — Single File: `src/pages/AdminDashboard.tsx`

**1. Sidebar visibility: `md:flex` → `lg:flex`**
- Line 967: `aside className="hidden md:flex …"` → `"hidden lg:flex …"`

**2. Main column left margin: `md:ml-56` → `lg:ml-56`**
- Line 991: Update margin class

**3. Header elements: update `md:` → `lg:` breakpoints**
- Back button and mobile branding: `md:hidden` → `lg:hidden`
- Desktop section label: `hidden md:block` → `hidden lg:block`
- Desktop search: `hidden md:block` → `hidden lg:block`
- Mobile search: `md:hidden` → `lg:hidden`
- Header icon sizes: keep as-is (already responsive)

**4. Mobile nav section label + hamburger: `md:hidden` → `lg:hidden`**
- Line 1085: Show hamburger menu for both mobile and tablet

**5. Activity Feed sidebar: `md:mr-72` → `lg:mr-72`** and the feed aside `md:flex` → `lg:flex`

### Result
- **Desktop (≥1024px)**: Fixed sidebar + full layout (unchanged)
- **Tablet (768–1023px)**: No fixed sidebar; uses hamburger drawer like mobile; full-width content
- **Mobile (<768px)**: Unchanged

### Technical Details
- ~10 class name changes, all in the same file
- No structural or logic changes
- The Sheet-based mobile drawer already exists and handles navigation perfectly

