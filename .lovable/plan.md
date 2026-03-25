

## Redesign: Premium API Keys UI

### Design Direction
Replace the plain table and basic stat cards with a polished, modern aesthetic featuring glass-morphism stat cards, refined typography, subtle gradients, dot-pattern status indicators, and a cleaner table with better visual hierarchy.

### Changes in `src/components/admin/AdminApiKeys.tsx`

**1. Summary Cards -- Glass-morphism style**
- Replace plain `Card` with gradient backgrounds + backdrop-blur
- Total Keys: subtle primary gradient bg, Live icon with glow
- Active: emerald gradient tint
- Revoked: rose/red gradient tint
- Add ring/border highlights, larger icon with rounded bg container
- Use `tracking-tight` on numbers, `uppercase tracking-wider text-[10px]` on labels

**2. Desktop Table -- Premium refinement**
- Card wrapper: `border-0 shadow-lg rounded-2xl overflow-hidden`
- Table header: `bg-muted/30` with `uppercase text-[11px] tracking-wider font-semibold text-muted-foreground/70` styling
- Rows: remove default borders, use `hover:bg-primary/[0.03]` subtle hover, add `border-b border-border/50` thin separator
- API Key code block: refined with `bg-gradient-to-r from-muted/80 to-muted/40 border border-border/50 rounded-md` 
- Env badge: pill style with dot indicator (`w-1.5 h-1.5 rounded-full bg-emerald-500` for Live, `bg-amber-500` for Test) instead of solid badge
- Status badge: softer colors -- Active gets `bg-emerald-500/10 text-emerald-600 border-emerald-500/20`, Revoked gets `bg-red-500/10 text-red-600 border-red-500/20`
- Permissions: show as subtle `bg-primary/5 text-primary rounded-full px-2.5 py-0.5` chip
- Action buttons: icon-only with tooltips for Rotate/Delete, text for Revoke/Reactivate with refined sizing

**3. Mobile Cards -- Elevated design**
- `rounded-2xl border-0 shadow-md` wrapper
- Top section: merchant name with env/status pills aligned right
- API key section: full-width code block with gradient bg
- Action row: refined button styling with `rounded-xl` corners

**4. Dialogs -- Polish**
- Add subtle gradient header bg to Generate Key and Permissions dialogs
- Credential reveal section: use card-in-card pattern with amber/warning tint background
- Better spacing and label hierarchy

All logic (fetching, mutations, realtime) remains unchanged. Only the JSX class names and minor structural nesting for visual purposes.

