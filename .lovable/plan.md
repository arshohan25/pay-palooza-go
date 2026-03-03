

## Update All +880 References to +88

Four files contain `+880` that need updating to `+88`:

1. **`src/pages/AccountPage.tsx`** (lines 227, 343) — profile card phone display and sign-out subtitle
2. **`src/hooks/use-profile.ts`** (line 61) — masked phone fallback in `displayName`
3. **`src/pages/AuthPage.tsx`** (line 918) — OTP "code sent to" message
4. **`src/pages/AgentDashboard.tsx`** (line 581) — support phone number `tel:+8801800000000` — this is an actual phone number URI, not a display prefix, so it should stay as-is

### Changes
- **AccountPage.tsx** line 227: `+880 ${registeredPhone}` → `+88 ${registeredPhone}`
- **AccountPage.tsx** line 343: `+880 ${registeredPhone}` → `+88 ${registeredPhone}`
- **use-profile.ts** line 61: `+880 ${profile.phone...}` → `+88 ${profile.phone...}`
- **AuthPage.tsx** line 918: `+880 {phone || returningPhone}` → `+88 {phone || returningPhone}`

Four simple string replacements across 3 files.

