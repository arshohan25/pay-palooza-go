

## Add QR Button Shortcut on Merchant Balance Card

### What
Replace the static Wallet icon on the merchant dashboard's balance hero card with a QR Code shortcut button that triggers the Dynamic QR payment flow.

### Changes — `src/pages/MerchantDashboard.tsx`

1. **Replace Wallet icon with QR button** (around line 361): Change the `div` containing the `<Wallet>` icon to a `motion.button` with a `<QrCode>` icon that calls `handleTestDynamicQR` on tap.

2. **Add `QrCode` to imports**: Add `QrCode` to the existing lucide-react import.

The button will keep the same rounded glass styling (`bg-white/10 rounded-xl`) but become interactive with a tap animation, giving merchants one-tap access to generate a payment QR directly from the balance card.

