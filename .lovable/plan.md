

## Fix: Bengali Tagline Showing When Language is English

The marked area shows the Bengali tagline "বাংলাদেশের সবচেয়ে সহজ ডিজিটাল ওয়ালেট" displaying even when the UI language is set to English. This happens because line 683 in `AuthPage.tsx` uses `t.taglineBn` (always Bengali) instead of `t.tagline` (language-aware).

### Change

**`src/pages/AuthPage.tsx`** (line 683)
- Replace `{t.taglineBn}` with `{t.tagline}` so the tagline respects the selected language:
  - English: "Bangladesh's Simplest Digital Wallet"
  - Bengali: "বাংলাদেশের সবচেয়ে সহজ ডিজিটাল ওয়ালেট"

Single-line fix.

