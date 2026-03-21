

## Fix Hamburger Menu Bottom Items Not Accessible

### Problem
The right-side hamburger menu drawer has 8 menu items that overflow the visible area on a 638px viewport. The content area (`flex-1 p-3`) doesn't scroll, so bottom items like "Settlement" and "Fees & Charges" are cut off.

### Fix in `src/pages/MerchantDashboard.tsx`

**Line 559**: Add `overflow-y-auto` to the menu items container so it scrolls when content overflows:

```
// Before
<div className="flex-1 p-3 space-y-1.5">

// After
<div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
```

### File Modified
- `src/pages/MerchantDashboard.tsx` (1 line change)

