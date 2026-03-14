

## Add Clear Zone Around QR Logo

Add a small white/cleared area behind the logo (slightly larger than the logo itself) to create visual breathing room between the logo and QR pattern, making it look clean and professional.

### Change: `src/lib/qrWithLogo.ts`

In `drawLogoOnCanvas`, before drawing the logo, clear a slightly larger rounded-rect area (logo size + ~30% padding) with a white fill and subtle rounded corners. Then draw the logo on top. This creates a professional "clear zone" without the oversized background from before.

