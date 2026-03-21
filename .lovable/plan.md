

## Redesign Dynamic QR Card

### Changes to `src/pages/MerchantDashboard.tsx` (lines 880-898)

- **Icon**: Reduce container from `w-14 h-14` to `w-10 h-10`, icon from 26 to 18, corners from `rounded-2xl` to `rounded-xl`
- **Title**: Keep "Dynamic QR" on its own line
- **Description**: Break into two lines — line 1: "Generate a QR code that customers", line 2: "scan to pay instantly"
- **Button**: Keep as-is (pill shape, Generate QR)

