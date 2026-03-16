

## Improve Admin Dashboard Mobile Responsiveness

### Problems Identified (at 390px viewport)

1. **Header cluttered** — search input, status badge, refresh/activity buttons all compete for space in top bar
2. **StatCards overflow** — `p-4` padding + `w-12 h-12` icon box + large text in a 2-col grid causes text wrapping/clipping (e.g. "Pending Funds" value `"3 / ৳12,500"`)
3. **Agents sub-tab has NO mobile card layout** — raw table with `overflow-x-auto` forces horizontal scroll on 390px
4. **Merchants sub-tab has NO mobile card layout** — same issue
5. **Trash/Deleted Users has NO mobile card layout** — same issue
6. **Overview transactions table** — `px-4` cell padding wastes space on mobile; time column too wide

### Implementation Plan

All changes are in **`src/pages/AdminDashboard.tsx`** only.

#### 1. Compact StatCard on mobile
- Reduce icon box to `w-10 h-10` and icon to `w-5 h-5` on mobile
- Reduce padding to `p-3` on mobile, keep `p-4` on desktop
- Shrink value text to `text-xl` on mobile

#### 2. Compact header on mobile
- Hide the activity feed button on mobile header row (it's accessible via the sheet anyway — keep it but shrink)
- Make the refresh + activity buttons `h-7 w-7` on mobile

#### 3. Add mobile card layout for Agents sub-tab
- Mirror the Users mobile pattern: `md:hidden` card list with business name, territory, status badge, and action buttons

#### 4. Add mobile card layout for Merchants sub-tab
- Same pattern: business name, category, status badge, action buttons

#### 5. Add mobile card layout for Trash tab
- Card list with name, phone, balance, deletion date, and View button

#### 6. Compact overview transactions table on mobile
- Reduce cell padding from `px-4` to `px-3` on mobile
- Truncate long values

### Files Changed

| File | Action |
|------|--------|
| `src/pages/AdminDashboard.tsx` | **Edit** — 6 targeted changes for mobile responsiveness |

