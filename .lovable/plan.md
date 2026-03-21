

## Tighten Dynamic QR Page Spacing

### Problem
The QR payment page has excessive vertical gaps between elements (header, QR code, status indicators, button, footer), making it feel loose rather than premium and compact.

### Changes in `src/pages/DynamicQrPage.tsx`

1. **Header section (line 200)**: Reduce padding from `px-6 pt-6 pb-4` → `px-5 pt-5 pb-3`; icon margin `mb-3` → `mb-2`; amount `mt-1` → `mt-0.5`

2. **Pending content area (line 214)**: Reduce from `p-6 space-y-5` → `p-4 space-y-3` to tighten QR + status cluster

3. **QR container (line 216)**: Reduce padding from `p-4` → `p-3`; shrink QR image from `w-64 h-64` → `w-56 h-56`

4. **Footer "Powered by" (line 269)**: Reduce from `px-6 pb-5 pt-2` → `px-5 pb-3 pt-1`

5. **Completed/Expired states (lines 250, 261)**: Reduce `p-8 space-y-4` → `p-5 space-y-3`

### Result
Tighter, more cohesive card with a premium compact feel — no wasted vertical space.

### File Modified
- `src/pages/DynamicQrPage.tsx`

