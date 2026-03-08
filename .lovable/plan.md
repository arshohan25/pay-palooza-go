

## Plan: Filter Promo Banners by Toggle State + Add Blank Future Toggles

### 1. Filter promo banners linked to disabled features (`src/components/PromoSlider.tsx`)

Import `useGlobalToggles` and filter out banners whose `link_url` starts with `feature:` and the corresponding feature key is disabled.

- Extract feature key from `link_url` (e.g., `"feature:refer"` → `"refer"`)
- Map it through the same `FEATURE_MAP` logic (or check directly since banner link keys match toggle keys)
- Filter banners before rendering so disabled-feature banners are completely hidden
- Apply filtering after data load, computing a `visibleBanners` array via `useMemo`

### 2. Add blank placeholder toggles for future features (database insert)

Insert 5 new "blank" toggle rows with `is_enabled: false` so they don't show anything until an admin turns them on. These serve as reserved slots for upcoming features:

| Feature Key | Label | Enabled | Sort Order |
|---|---|---|---|
| `feature_slot_1` | New Feature 1 | false | 19 |
| `feature_slot_2` | New Feature 2 | false | 20 |
| `feature_slot_3` | New Feature 3 | false | 21 |
| `feature_slot_4` | New Feature 4 | false | 22 |
| `feature_slot_5` | New Feature 5 | false | 23 |

Admins can rename these via the existing AdminGlobalToggles UI and turn them on when ready.

### 3. Add blank feature slot support in QuickActions (`src/components/QuickActions.tsx`)

Add the 5 blank feature slots to `FEATURE_MAP` and create placeholder entries in `moreServices` that only render when the corresponding toggle is enabled. When disabled (default), they are completely hidden from the UI — not greyed out, just absent. When an admin enables one and updates its label, it appears automatically.

### Files Modified
- `src/components/PromoSlider.tsx` — import `useGlobalToggles`, filter banners by toggle state
- `src/components/QuickActions.tsx` — add blank feature slot entries that show/hide based on toggle
- **Database insert** — 5 new blank toggle rows (disabled by default)

