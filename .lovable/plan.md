## Redesign DynamicQrPage — Premium Minimalist Card (Matching Reference)

Redesign the QR payment page to match the uploaded reference screenshot's clean, airy aesthetic. The "Pay with EasyPay" button is excluded per request. All backend logic stays untouched.

### Design Changes to `src/pages/DynamicQrPage.tsx`

**Background**: Subtle gradient mesh background (primary/accent radial gradients) instead of plain `bg-background`

**Main card**: Glassmorphism — `bg-card/90 backdrop-blur-2xl`, `rounded-3xl`, `shadow-2xl shadow-primary/5`, `border border-white/10`

**Header section**:

- Merchant icon in a rounded pill with soft gradient background (`bg-gradient-to-br from-primary/20 to-primary/5`)
- Merchant name in bold, category below in muted text
- Amount with taka symbol in large bold font, currency in a small muted pill badge
- Reference in subtle muted text

**QR section**:

- White rounded container with soft shadow, generous padding
- QR image slightly smaller for breathing room

**Status indicators**:

- "Scan with EasyPay app to pay" text stays
- Clock icon + countdown in clean mono font
- Pulsing dot "Waiting for payment…" indicator

**Remove**: The "Pay with EasyPay" button (marked in red in reference)

**Footer**: Thin separator line above "Powered by EasyPay" in subtle muted text

**Completed/Expired/Error states**: Match the same glassmorphism card style

**No backend changes** — all hooks, realtime subscriptions, callbacks preserved exactly.