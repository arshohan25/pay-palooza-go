

## Remove White Background from QR Logo

Simple change: remove the white rounded-rect background behind the logo, and draw the logo directly on top of the QR code with no padding/border.

### Change in `src/lib/qrWithLogo.ts`

In `drawLogoOnCanvas`, remove the white background drawing code (lines 27-46) and draw the logo directly centered at the computed size with no extra padding.

