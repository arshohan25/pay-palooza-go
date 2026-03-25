

## Auto-Track Referrals via Link Only (Remove Manual Code Input)

### What Changes

The referral code input field on registration will be removed. Referrals will only be tracked automatically when someone registers via a referral link (e.g., `https://pay-palooza-go.lovable.app/?ref=EZP-XXXX-XXXX`). The `?ref=` param is silently captured and used during signup — no user interaction needed.

### Changes

**1. AuthPage.tsx — Remove manual referral UI, keep silent URL capture**
- Remove the collapsible "Have a referral code?" section (lines ~914-963) entirely
- Remove `referralExpanded` and `referralError` state variables
- Keep `referralCodeInput` state but populate it silently from `?ref=` URL param only (existing `useEffect` already does this)
- Remove the `Gift` and `ChevronDown` imports if unused elsewhere

**2. ReferPage.tsx — Ensure share links use the deep link URL**
- Already done from prior work; verify share text includes `?ref=CODE` URL

**3. lib/auth.ts — No changes needed**
- The `signUp()` function already accepts and processes the referral code; it just won't receive one unless `?ref=` was in the URL

### Result
- Users sharing their referral link → recipient clicks → opens registration page → `?ref=CODE` is silently captured → on signup the referral row is created automatically
- No manual code entry available — cleaner UX, prevents typos, and enforces link-based tracking

