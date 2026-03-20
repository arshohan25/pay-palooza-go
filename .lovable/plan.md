

## Redesign PayPage & GuestCheckoutFlow — Minimal, Futuristic, Premium

Redesign both components with a glass-morphism card aesthetic, subtle gradients, refined spacing, and a premium feel while keeping all existing functionality intact.

### Design Language
- **Glass card**: `backdrop-blur-xl bg-white/5 border border-white/10` with subtle shadow
- **Gradient background**: Subtle radial gradient instead of flat `bg-background`
- **Step indicator**: Thin progress dots/bar showing Phone → OTP → PIN
- **Premium typography**: Larger amount display, lighter weight labels, more breathing room
- **Frosted icon containers**: Translucent icon backgrounds with soft glow
- **Smooth transitions**: Scale/opacity animations on step changes

### File 1: `src/pages/PayPage.tsx`
- Wrap choice screen in a centered glass card with gradient background
- Redesign payment summary with larger, bolder amount and subtle merchant badge
- Method buttons become premium cards with hover glow effect and arrow indicator
- QR screen gets glass card treatment with frosted container
- Loading state uses a pulsing ring animation

### File 2: `src/components/GuestCheckoutFlow.tsx`
- Add a 3-step progress indicator (dots) at the top of each step
- Wrap each step's content in a single glass card container
- SummaryCard becomes a compact inline header within the glass card (not a separate card)
- Phone input gets a sleek borderless style inside the card
- OTP slots get frosted backgrounds with subtle borders
- PIN step uses larger, spaced-out slots with lock icon glow
- Processing: pulsing concentric rings instead of simple spinner
- Success: animated checkmark with confetti-like particle burst
- Error: subtle red glow on card border

### Visual Structure (Choice Screen)
```text
┌─────────────────────────────┐
│   ◌ gradient bg             │
│                             │
│   ┌───────────────────┐     │
│   │  ░░ glass card ░░ │     │
│   │                   │     │
│   │   💳  Payment     │     │
│   │   ৳100           │     │
│   │   MRC-RAFIQ-001   │     │
│   │   Ref: KXNCNESY   │     │
│   │                   │     │
│   │  ┌─────────────┐  │     │
│   │  │ 📱 Phone&PIN│→ │     │
│   │  └─────────────┘  │     │
│   │  ┌─────────────┐  │     │
│   │  │ 🔐 Log In   │→ │     │
│   │  └─────────────┘  │     │
│   └───────────────────┘     │
│                             │
│   Secured by EasyPay        │
└─────────────────────────────┘
```

### No functional changes
All logic, API calls, state management, and edge function calls remain identical. This is purely a UI/styling redesign.

