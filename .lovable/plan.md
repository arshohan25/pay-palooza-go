

## Remove country code prefix and center-align phone input

### Changes to `src/pages/PayPage.tsx`

**Phone input field (lines 476-483):**
- Remove the `+880` prefix span and left padding
- Center-align the input text with `text-center` styling
- Use a cleaner, premium look: larger font, more padding, subtle glow on focus
- Update placeholder to `01XXXXXXXXX` (already correct)

**OTP step text (line 503):**
- Change `Sent to +880{phone}` → `Sent to {phone}` (remove country code reference)

**Styling details:**
- Input: `text-center text-lg font-semibold tracking-widest` for a premium centered number feel
- Remove `pl-16` (was for country code), use symmetric `px-6`
- Add `placeholder:text-center` for centered placeholder
- Keep existing border/backdrop-blur styling, enhance focus ring

