

## Plan: Fill Logo Transparent Areas with White

### Problem
The EasyPay logo has transparent areas (visible in the reference image circled in red — the inner circle/pin hole area). When displayed on colored backgrounds (like the teal splash screen), the background bleeds through these transparent regions.

### Solution
Use the AI image editing model to process the current logo (`src/assets/easypay-logo.png`) and fill all transparent/blank areas with solid white. Then copy the result to all logo locations:

- `src/assets/easypay-logo.png`
- `public/icons/easypay-logo.png`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/favicon.ico`

### Implementation
1. Create a simple utility edge function or inline script that sends the current logo to the Gemini image model with the instruction "Fill all transparent/blank areas with solid white color, keep the logo design unchanged"
2. Save the edited image to all logo asset locations

### Files modified
- `src/assets/easypay-logo.png`
- `public/icons/easypay-logo.png`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/favicon.ico`

