

## Fix: Dark/Light Mode Not Working with Festival Themes

### Root Cause

The `FestivalThemeProvider` applies light-mode palette overrides as **inline styles** on `document.documentElement.style`. Inline styles have **higher CSS specificity** than any class-based rule, including `.dark { --primary: ... }`. So when the user toggles to dark mode, the light-mode festival values win, and the dark palette never takes effect.

### Fix

Instead of setting light-mode variables as inline styles, inject **all** festival overrides (both light and dark) into a single `<style>` element with proper CSS specificity:

```css
/* Injected <style id="festival-theme-vars"> */
:root { --primary: 270 60% 55%; --background: 245 30% 12%; ... }
.dark { --primary: 280 50% 65%; --background: 250 25% 8%; ... }
```

This ensures `.dark` rules properly override `:root` rules when the class toggles.

### Changes

**`src/contexts/FestivalThemeContext.tsx`** — Rewrite `applyPalette` and `clearPalette`:
- Stop using `root.style.setProperty()` for light-mode vars
- Build a single `<style id="festival-theme-vars">` element containing both `:root { ... }` and `.dark { ... }` blocks
- `clearPalette` simply removes the style element and body pattern class

