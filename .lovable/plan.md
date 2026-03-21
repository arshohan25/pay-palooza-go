

## Add Toast on Link Copy

### Change — `src/pages/MerchantDashboard.tsx`

Two clipboard copy actions currently lack toast feedback:

1. **Line 836** (after QR generation): `navigator.clipboard.writeText(fullUrl).catch(() => {})` — add toast: "Link copied!"
2. **Lines 1134-1136** (Copy Payment Link button): add toast after clipboard write: "Payment link copied to clipboard"

Both will use the existing `toast()` import already in the file.

