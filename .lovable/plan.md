

## Remove Unwanted Spaces from QR Page

The screenshot marks three areas of excess space:
1. **Left/right padding** on the card sides (red marks on left and right edges)
2. **Gap between Ref line and QR code** (red mark between reference text and QR)

### Changes — `src/pages/DynamicQrPage.tsx`

1. **Line 200**: Reduce horizontal padding from `px-5` to `px-3` in header
2. **Line 214**: Reduce horizontal padding from `p-3` to `px-2 py-2` in pending content area  
3. **Line 210 → header closing div**: Remove bottom padding gap — change `pb-2` to `pb-1`
4. **Line 214**: Reduce `space-y-2` to `space-y-1.5` to tighten vertical gaps between QR elements

