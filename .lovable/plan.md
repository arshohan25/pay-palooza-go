

# Fix Bangla Language Support Across Splash and PIN Screens

## Problem
Several strings on the PIN login screen are hardcoded in English and do not switch when the user toggles to Bangla. The splash screen always shows Bangla tagline but is not language-aware. The inline HTML splash in `index.html` uses system fonts instead of the Bangla font.

## Hardcoded English strings found

| Location | Current (hardcoded) | Should be (Bangla) |
|----------|--------------------|--------------------|
| PIN screen greeting | "Good Morning ☀️" | "সুপ্রভাত ☀️" |
| PIN screen greeting | "Good Afternoon 🌤️" | "শুভ অপরাহ্ন 🌤️" |
| PIN screen greeting | "Good Evening 🌙" | "শুভ সন্ধ্যা 🌙" |
| PIN screen heading | "Welcome Back" | "স্বাগতম" |
| PIN screen badge | "Secured" | "সুরক্ষিত" |
| PIN footer | "Sending…" | "পাঠানো হচ্ছে…" |

Note: The i18n.tsx file already has `goodMorning`, `goodAfternoon`, `goodEvening`, `welcomeBack` translations. The AuthPage has its own `T` object with `welcomeBack` too. We just need to wire them up.

## Changes

### 1. `src/pages/AuthPage.tsx` — Wire up translations on PIN screen
- **Line 825**: Replace hardcoded greeting with `t.` lookups. The AuthPage `T` object doesn't have greeting keys yet, so add `goodMorning`, `goodAfternoon`, `goodEvening`, `secured` to both `T.en` and `T.bn`
- **Line 826**: Replace `"Welcome Back"` with `t.welcomeBack` (already exists in T)
- **Line 788**: Replace `"Secured"` with `t.secured` (new key)
- **Line 881**: Replace `"Sending…"` with appropriate translated string (use existing pattern)

### 2. `src/pages/AuthPage.tsx` — Add missing keys to T object
Add to `T.en`:
```
goodMorning: "Good Morning", goodAfternoon: "Good Afternoon", goodEvening: "Good Evening",
secured: "Secured",
```
Add to `T.bn`:
```
goodMorning: "সুপ্রভাত", goodAfternoon: "শুভ অপরাহ্ন", goodEvening: "শুভ সন্ধ্যা",
secured: "সুরক্ষিত",
```

### 3. `src/components/SplashScreen.tsx` — Make language-aware
- Read `localStorage.getItem("mfs_ui_lang")` to determine language
- Switch app name between "EasyPay" / "ইজিপে" and tagline accordingly
- Ensure `font-family` includes `'Anek Bangla'` for proper Bangla rendering

### 4. `index.html` — Inline HTML splash font fix
- Add `'Anek Bangla'` to the inline splash's font-family so the Bangla tagline renders with the correct font even before React mounts (graceful fallback since font loads async)

## Files Changed
- `src/pages/AuthPage.tsx` — Add translation keys, replace hardcoded strings
- `src/components/SplashScreen.tsx` — Language-aware text
- `index.html` — Add Bangla font to inline splash styles

