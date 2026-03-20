

## Center-Align All Text on Payment Page (/pay)

### Changes to `src/pages/PayPage.tsx`

Add `text-center` to all container divs that don't already have it, ensuring every text element is horizontally centered:

1. **Phone input step** (line 473) — add `text-center` to the wrapper div
2. **OTP step** (line 502) — already has `text-center` on inner div, ensure wrapper also centered
3. **PIN step** (line 522) — already has `text-center` on inner div, ensure wrapper also centered
4. **Processing step** (line 543) — already centered via flex
5. **Error message texts** — already `text-center`
6. **Ref/Note lines** (lines 442-443) — these lack `text-center`; add it
7. **Dev OTP line** (line 509) — already centered

Specific lines to update:
- Line 442: `<p className="text-[10px] text-muted-foreground mt-1.5 font-mono">` → add `text-center`
- Line 443: `<p className="text-[10px] text-muted-foreground font-mono">` → add `text-center`
- Lines 450, 473, 502, 522: ensure all step wrapper divs include `text-center` alongside `space-y-*`

Single file change: `src/pages/PayPage.tsx`

