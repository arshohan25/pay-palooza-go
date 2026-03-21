

## Fix Mismatched Month Navigation Arrows

The left arrow currently uses `ArrowLeft` (←) while the right uses `ChevronRight` (›). Both should use matching chevron icons.

### Change in `src/pages/MerchantDashboard.tsx`

**Line 1446**: Replace `<ArrowLeft size={16} />` with `<ChevronLeft size={16} />`

Also ensure `ChevronLeft` is imported from lucide-react (it may already be, but needs verification).

### Files modified
- `src/pages/MerchantDashboard.tsx`

