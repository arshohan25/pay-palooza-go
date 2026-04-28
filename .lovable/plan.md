## Update Merchant Login Page to Match Dashboard Theme

### Problem
The merchant login page currently uses a dark gradient background (`from-slate-950 via-indigo-950 to-emerald-950`) with emerald accents. This doesn't match the merchant/agent dashboard which uses the app's standard light theme with `bg-background` and `gradient-hero` for headers.

### Solution
Update the merchant login page styling to align with the dashboard theme:

1. **Background**: Change from dark gradient to `bg-background` (light theme)
2. **Header section**: Use `gradient-hero` class for the top hero area (matching dashboard header)
3. **Card styling**: Update glass card to use standard card colors (`bg-card`, `border-border`)
4. **Text colors**: Change from `text-white` to `text-foreground` / `text-muted-foreground`
5. **Accent colors**: Replace emerald accents with `primary` color
6. **Input styling**: Update to use standard input borders (`border-input`, `focus:border-primary`)
7. **Button styling**: Use `gradient-hero` or `bg-primary` instead of emerald gradient

### Files to Edit
- `src/pages/MerchantLoginPage.tsx` — Update all color classes

### Technical Details
- The `gradient-hero` CSS variable is already defined in `src/index.css` and provides the teal/green gradient used across the app
- The `bg-background` variable provides the light off-white background
- All standard Tailwind CSS variables (`--primary`, `--card`, `--border`, etc.) are already configured
- No database or backend changes required — purely UI styling update